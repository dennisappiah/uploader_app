const net = require("net");
const fs = require("fs");
const path = require("path");
const { mkdir, open } = require("fs/promises");

const server = net.createServer();

server.on("connection", async (socket) => {
  console.log("New connection");

  let fileWriteStream;
  let isHeaderProcessed = false;
  let filename = "";

  socket.on("data", async (data) => {
    try {
      if (!isHeaderProcessed) {
        // Find the delimiter
        const delimiter = "-------";
        const delimiterIndex = data.indexOf(delimiter);

        if (delimiterIndex !== -1) {
          // Extract filename
          filename = data.subarray(10, delimiterIndex).toString("utf-8");
          console.log("Filename received:", filename);

          // Ensure storage directory exists
          await mkdir("storage", { recursive: true });

          // Open file handle and create write stream
          const fileHandle = await open(path.join("storage", filename), "w");
          fileWriteStream = fileHandle.createWriteStream();

          // Write the remaining data after the delimiter
          const fileData = data.subarray(delimiterIndex + delimiter.length);
          console.log("Initial data length:", fileData.length);

          // Write initial data to the file
          fileWriteStream.write(fileData);

          isHeaderProcessed = true;

          // Pipe remaining data from socket to file stream
          socket.pipe(fileWriteStream);
        }
      }
    } catch (err) {
      console.error("Error handling data:", err);
      if (fileWriteStream) {
        fileWriteStream.end();
      }
      socket.end();
    }
  });

  socket.on("end", async () => {
    try {
      if (fileWriteStream) {
        fileWriteStream.end();
      }
      console.log("File successfully received and saved.");
    } catch (err) {
      console.error("Error closing file handle:", err);
    } finally {
      fileWriteStream = undefined;
      isHeaderProcessed = false;
      console.log("Connection ended");
    }
  });

  socket.on("error", async (err) => {
    console.error("Socket error:", err);
    if (fileWriteStream) {
      fileWriteStream.end();
    }
    fileWriteStream = undefined;
    isHeaderProcessed = false;
  });
});

server.listen(5050, "::1", () => {
  console.log("Uploader server opened on", server.address());
});
