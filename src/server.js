const net = require("net");
const fs = require("fs/promises");
const path = require("path");

const server = net.createServer();

let fileHandle, fileWriteStream;
let isHeaderProcessed = false;
let filename = "";

server.on("connection", (socket) => {
  console.log("New connection");

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
          await fs.mkdir("storage", { recursive: true });

          // Open file handle and create write stream
          fileHandle = await fs.open(path.join("storage", filename), "w");
          fileWriteStream = fileHandle.createWriteStream();

          // Set up drain event listener once
          fileWriteStream.on("drain", () => {
            console.log("Resuming socket after drain");
            socket.resume();
          });

          // Write the remaining data after the delimiter
          const fileData = data.subarray(delimiterIndex + delimiter.length);
          console.log("Initial data length:", fileData.length);

          if (fileData.length > 0) {
            fileWriteStream.write(fileData);
          }

          isHeaderProcessed = true;
        }
      } else {
        console.log("Writing data chunk:", data.length, "bytes");
        if (!fileWriteStream.write(data)) {
          socket.pause();
        }
      }
    } catch (err) {
      console.error("Error handling data:", err);
      if (fileHandle) {
        await fileHandle.close();
      }
      fileHandle = undefined;
      fileWriteStream = undefined;
      socket.end();
    }
  });

  socket.on("end", async () => {
    try {
      if (fileHandle) {
        await fileHandle.close();
      }
      console.log("File successfully received and saved.");
    } catch (err) {
      console.error("Error closing file handle:", err);
    } finally {
      fileHandle = undefined;
      fileWriteStream = undefined;
      isHeaderProcessed = false;
      console.log("Connection ended");
    }
  });

  socket.on("error", async (err) => {
    console.error("Socket error:", err);
    if (fileHandle) {
      await fileHandle.close();
    }
    fileHandle = undefined;
    fileWriteStream = undefined;
    isHeaderProcessed = false;
  });
});

server.listen(5050, "::1", () => {
  console.log("Uploader server opened on", server.address());
});
