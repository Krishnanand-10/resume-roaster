const express = require('express');
const app = express();
const PORT = 3000;

// Serve static frontend files (index.html, styles, scripts) from 'public' directory
app.use(express.static('public'));

// Parse incoming request body payloads as JSON
app.use(express.json());

// Define the POST endpoint route for resume roasts
app.post('/roast', (req, res) => {
    console.log('Received roast request on backend!');
    res.json({ message: "🔥 Resume Roast Placeholder: Backend connected successfully!" });
});

// Start listening for incoming HTTP connections on port 3000
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
