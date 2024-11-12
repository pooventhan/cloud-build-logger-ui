// TODO: Update the services and baseUrl

const services = [];
const baseUrl = "https://example.com";
const apiUrl = "/api/builds/latest";

async function fetchBuildDetails(serviceName) {
  try {
    const response = await fetch(`${apiUrl}?serviceName=${serviceName}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      return null; // Return null if no successful record is found
    }
  } catch (error) {
    console.error("Error fetching build details:", error);
    return null;
  }
}

function extractEnvironmentName(serviceName, triggerName){
    var trimmed = triggerName.replace(serviceName + "-", "");
    trimmed = trimmed.replace("-from-feature", "");
    return trimmed;
}

function classifyRecords(buildDetails){
    const buildRecords = [];

    for(const build of buildDetails){

        // The legacy build which performs deployment based on branch name.
        if(build.substitutions._SERVICE_NAME === build.substitutions.TRIGGER_NAME)
        {
            const record = {
                serviceName: build.substitutions._SERVICE_NAME,
                environment: build.substitutions.BRANCH_NAME === 'develop' ? 'dev' : build.substitutions.BRANCH_NAME, // Only need to handle for develop. No issues for qa & uat
                branch: build.substitutions.BRANCH_NAME,
                finishTime: new Date(build.finishTime)
            }

            buildRecords.push(record);
            continue;
        }

        // The newer way which is using feature branch.
        const record = {
            serviceName: build.substitutions._SERVICE_NAME,
            environment: extractEnvironmentName(build.substitutions._SERVICE_NAME, build.substitutions.TRIGGER_NAME),
            branch: build.substitutions.BRANCH_NAME,
            finishTime: new Date(build.finishTime)
        }

        buildRecords.push(record);
    }

    return buildRecords;
}

function filterOutdatedRecords(buildRecords){

    const latestData = Array.from(
        buildRecords.reduce((acc, item) => {
          // Create a unique key based on serviceName and environment
          //const key = `${item.serviceName}-${item.environment}-${item.branch}`;
          const key = `${item.serviceName}-${item.environment}`;
      
          // Compare finishTime, and keep the latest one
          if (!acc.has(key) || new Date(acc.get(key).finishTime) < new Date(item.finishTime)) {
            acc.set(key, item);
          }
      
          return acc;
        }, new Map()).values() // Use only the values from the Map to get the filtered array
    );
    
    return latestData;
}

async function getLatestBuilds(){
    var builds = [];

    for (const service of services) {
        // Fetch build details once per service
        const buildData = await fetchBuildDetails(service);
        const classifiedRecords = classifyRecords(buildData);
        const latestRecords = filterOutdatedRecords(classifiedRecords);

        builds = builds.concat(latestRecords);
    }

    console.log(builds);
    return builds;
}

async function loadBuildDetails() {
    const latestData = await getLatestBuilds();
    
    // Extract unique environments and service names
    const environments = Array.from(new Set(latestData.map(item => item.environment))).sort();
    console.log(environments);

    const serviceNames = Array.from(new Set(latestData.map(item => item.serviceName)));
  
    const tableHead = document.querySelector("#buildTable thead");
    const tableBody = document.querySelector("#buildTable tbody");
  
    // Clear existing table content
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
  
    // Create table header
    const headerRow = document.createElement("tr");
    headerRow.appendChild(document.createElement("th")); // Empty top-left cell
    environments.forEach(env => {
      const th = document.createElement("th");
      th.textContent = env;
      headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);
  
    // Create table rows for each service name
    serviceNames.forEach(serviceName => {
      const row = document.createElement("tr");
  
      // First cell for the service name
      const serviceCell = document.createElement("td");
      serviceCell.textContent = serviceName;
      row.appendChild(serviceCell);
  
      // Cells for each environment
      environments.forEach(env => {
        const cell = document.createElement("td");
        const build = latestData.find(item => item.serviceName === serviceName && item.environment === env);

        if (build) {
            cell.innerHTML = `<strong>${build.branch}</strong><br><small><i>${build.finishTime.toLocaleString()}</i></small>`;
        } else {
            cell.textContent = "No Data";
        }

        //cell.textContent = build ? build.finishTime : "No Data";
        row.appendChild(cell);
      });
  
      tableBody.appendChild(row);
    });
}

// Load build details on page load
window.onload = loadBuildDetails;
