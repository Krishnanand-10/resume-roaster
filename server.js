const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

app.post('/roast', (req, res) => {
    console.log('Received roast request on backend!');
    res.json({ message: "🔥 Resume Roast Placeholder: Backend connected successfully!" });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
