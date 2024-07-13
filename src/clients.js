const net = require("net");
const fs = require("fs/promises");
const path = require("path");

const socket = net.createConnection({ host: "::1", port: 5050 }, async () => {
  console.log("connected to the server");

  // process.argv returns a list of path of arguments [node client.js text.txt]->0
  // [../bin/node, ../videos/client.js] -> 1
  // text.txt -> 2

  // Get the file path from the command line arguments
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      "No file path specified. Please provide a file path as an argument."
    );
    process.exit(1);
  }

  const fileName = path.basename(filePath);
  try {
    // Open the file for reading
    const fileHandle = await fs.open(filePath, "r");
    const fileReadStream = fileHandle.createReadStream();

    // Send the filename to the server with a delimiter
    socket.write(`filename: ${fileName}-------`);

    // Listen for data from the file read stream
    fileReadStream.on("data", (data) => {
      // If the socket's internal buffer is full, pause reading from the file
      if (!socket.write(data)) {
        fileReadStream.pause();
      }
    });

    // Resume reading from the file when the socket's buffer is drained
    socket.on("drain", () => {
      fileReadStream.resume();
    });

    // When the file read stream ends, close the file handle and end the socket connection
    fileReadStream.on("end", async () => {
      console.log("The file was successfully uploaded");
      await fileHandle.close();
      socket.end();
    });

    // Handle errors in the file read stream
    fileReadStream.on("error", async (err) => {
      console.error("Error reading the file:", err);
      await fileHandle.close();
      socket.end();
    });

    // Handle errors in the socket connection
    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });
  } catch (err) {
    console.error("Error opening the file:", err);
  }
});

// Handle connection errors
socket.on("error", (err) => {
  console.error("Connection error:", err);
});
