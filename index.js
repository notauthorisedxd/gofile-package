const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require("axios")

const validGofileServers = ["na", "eu"];


/**
 * @param {string} directoryPath path to the zip
 * @returns {Promise<boolean>} true or false
 */
async function checkZipDirectoryExists(directoryPath) {
  if (!directoryPath.endsWith('.zip')) {
    throw new Error('Provided path does not end with .zip');
  }
  try {
    await fs.promises.access(directoryPath, fs.constants.F_OK);
    const files = await fs.promises.readdir(directoryPath);
    return files.some((file) => path.extname(file).toLowerCase() === '.zip');
  } catch (err) {
    return false;
  }
}

/**
 * @param {string} [region="eu"] region if anything is not entered it sets it to "eu"
 * @param {boolean} [logging=false] logs what's going on
 * @returns {Promise<string|null>} the name of the server
 */
async function getServer(region = "eu", logging = false) {
    try {
        // Check if the provided region is valid
        if (!validGofileServers.includes(region)) {
            console.error("Invalid Gofile region.");
            return null;
        } else if (logging) {
            console.log(`Valid Gofile region: ${region}`);
        }

        // Fetch the list of servers using axios
        const response = await axios.get("https://api.gofile.io/servers");

        // Check if the response is okay
        if (response.status !== 200) {
            if (logging) {
                console.error(`Response is not okay: ${response}`);
            }
            throw new Error(`Failed to fetch servers. Status: ${response.status}`);
        }

        // Extract the servers data
        const servers = response.data.data.servers;

        if (logging) {
            console.log(`\n\nServers: ${JSON.stringify(servers, null, 2)}`);
        }

        // Find the server that matches the provided region
        const selectedServer = servers.find((server) => server.zone === region);

        // Return the server name if found
        if (selectedServer) {
            if (logging) {
                console.log(`Server has been found: ${selectedServer.name}`);
            }
            return selectedServer.name;
        } else {
            console.log(`No servers found for the ${region.toUpperCase()} zone.`);
            return null;
        }
    } catch (error) {
        // Handle any errors that occur during the request
        console.error("Error fetching servers:", error.message);
        console.error("Details:", error.response?.data || error.message);
        return null;
    }
}

  
/**
 * @param {string} filePath path to the zip file.
 * @param {string|null} server - The server name to upload to (default: null, will auto-select based on region).
 * @param {string} [region="eu"] - Region to select the server from if none is specified.
 * @param {string|null} folderId - Folder ID for the destination (default: null, creates a new folder).
 * @param {boolean} [logging=false] - Enable verbose logging for debugging.
 * @returns {Promise<string|null>} - The download URL of the uploaded file, or null if an error occurs.
 */
async function upload(filePath, server = null, region = "eu", folderId = null, logging = false) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        } else if (logging) {
            console.log(`File found at path: ${filePath}`);
        }

        if (await checkZipDirectoryExists(filePath)) {
            console.error(`Zip location is invalid: ${filePath}`);
            return null;
        }

        if (!server) {
            if (logging) console.log(`No server specified. Auto-selecting server in region: ${region}`);
            server = await getServer(region, logging);
            if (!server) throw new Error("Unable to select a server.");
        }

        const form = new FormData();
        form.append("file", fs.createReadStream(filePath));
        if (folderId) {
            form.append("folderId", folderId);
            if (logging) console.log(`Uploading to specified folder ID: ${folderId}`);
        } else if (logging) {
            console.log("No folder ID provided. A new public folder will be created.");
        }

        const uploadUrl = `https://${server}.gofile.io/contents/uploadFile`;
        if (logging) console.log(`Uploading file to server: ${uploadUrl}`);

        const response = await axios.post(uploadUrl, form, {
            headers: {
                ...form.getHeaders(), 
            },
        });

        if (response.data.status === "ok") {
            if (logging) console.log("File uploaded successfully!", response.data.data.downloadPage);
            return response.data.data.downloadPage;
        } else {
            throw new Error(`Failed to upload file: ${response.data.message}`);
        }
    } catch (error) {
        console.error("Error uploading file:", error.message);
        if (logging) console.error("Details:", error.response?.data || error.message);
        return null;
    }
}
module.exports = {
  upload,
  getServer
};