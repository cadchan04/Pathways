const express = require('express');
const cors = require('cors');

const app = express();

//console.log(app);

app.use(cors());

app.listen(8080, () => {
  console.log('Server is running on port 8080');
});

// Define a simple route
app.get('/api-test', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});