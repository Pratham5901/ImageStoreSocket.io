const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Serve static files from the public directory
app.use(express.static('public'));

// Serve uploaded files from the 'uploads' directory
app.use('/uploads', express.static('uploads'));

// Set up a basic route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle chat messages
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg); // Broadcast the message to all connected clients
  });

  // Emit existing images on connection
  const uploadPath = path.join(__dirname, 'uploads');
  fs.readdir(uploadPath, (err, files) => {
    if (err) {
      console.error('Error reading upload folder:', err);
      return;
    }

    const imageFiles = files.filter((file) => file.match(/\.(jpeg|jpg|gif|png)$/));
    const imageInfo = imageFiles.map((filename) => ({
      filename,
      path: `/uploads/${filename}`,
    }));

    console.log('Existing images:', imageInfo);
    socket.emit('existing images', imageInfo);
  });

  // Handle file uploads
  socket.on('file upload', (fileData) => {
    const buffer = Buffer.from(fileData, 'base64');

    // Update the file list
    const fileName = `file-${Date.now()}.png`; // Use the appropriate extension
    const filePath = path.join(__dirname, 'uploads', fileName);

    // Save the file to the local drive
    fs.writeFileSync(filePath, buffer);

    const fileInfo = {
      filename: fileName,
      path: `/uploads/${fileName}`,
    };

    console.log('File uploaded:', fileInfo);

    io.emit('file upload', fileInfo);
  });

  // Handle image deletion
  socket.on('delete image', (data) => {
    const filename = data.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    // Check if the file exists before attempting deletion
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File deleted: ${filename}`);
      io.emit('file deleted', filename);
    }
  });
});

// Set up the file upload route
app.post('/upload', upload.single('file'), (req, res) => {
  // After a file is uploaded, emit a message to all clients
  io.emit('file upload', {
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
  });
  res.send('File uploaded successfully!');
  res.redirect("/");
});

// Set up the file deletion route
app.post('/delete', (req, res) => {
  const filename = req.body.filename;
  console.log('Received delete request for filename:', filename);
  if (!filename) {
    res.status(400).send('Filename not provided');
    return;
  }

  const filePath = path.join(__dirname, 'uploads', filename);

  // Check if the file exists before attempting deletion
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`File deleted: ${filename}`);
    io.emit('file deleted', filename);
    res.send('File deleted successfully');
  } else {
    res.status(404).send('File not found');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
