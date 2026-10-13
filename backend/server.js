const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Only start accepting requests once the DB connection is established,
// so the app never serves traffic that is guaranteed to fail on every
// DB-backed route, and so a Mongo outage at boot doesn't silently kill
// an already-listening server out from under active connections.
connectDB().then(() => {
  require('./utils/cronJobs');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
