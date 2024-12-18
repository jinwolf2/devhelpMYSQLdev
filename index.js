require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Configuración de conexiones a las bases de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql', // Host para testdb
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'aMandATecARt',
  database: process.env.DB_NAME || 'testdb'
});

const logPool = mysql.createPool({
  host: process.env.LOG_DB_HOST || 'logdb', // Host para logdb
  user: process.env.LOG_DB_USER || 'root',
  password: process.env.LOG_DB_PASSWORD || 'IsMyColor2244*+',
  database: process.env.LOG_DB_NAME || 'logdb'
});

// Función para registrar logs en la base de datos logdb
const logCommand = async (command, clientIp) => {
  const connection = await logPool.getConnection();
  try {
    await connection.query(
      'INSERT INTO command_logs (command, client_ip, executed_at) VALUES (?, ?, NOW())',
      [command, clientIp]
    );
  } finally {
    connection.release();
  }
};

// Ruta para ejecutar una consulta SQL
app.post('/execute-query', async (req, res) => {
  const { query } = req.body;
  const clientIp = req.ip; // Obtener la IP del cliente

  try {
    // Registrar comandos y manejar comandos sensibles
    if (/DROP|DELETE/i.test(query)) {
      console.warn('Comando DROP/DELETE detectado, restableciendo base de datos...');
      await logCommand(query, clientIp); // Log del comando
      res.status(400).json({ error: 'Comando DROP/DELETE no permitido.' });
    } else {
      const [rows] = await pool.query(query);
      await logCommand(query, clientIp); // Log del comando
      res.json({ data: rows });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener el esquema de la base de datos
app.get('/schema', async (req, res) => {
  try {
    const [tables] = await pool.query(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = ?`,
      ['testdb']
    );

    const schemaDetails = {};
    for (const table of tables) {
      const [columns] = await pool.query(
        `SELECT column_name AS columnName, data_type AS dataType
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?`,
        ['testdb', table.tableName]
      );
      schemaDetails[table.tableName] = columns;
    }

    io.emit('schema-updated', schemaDetails);
    res.json({ schema: schemaDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configurar cron para restablecer la base de datos cada 24 horas
cron.schedule('0 0 * * *', async () => {
  console.log('Restableciendo base de datos cada 24 horas...');
  await resetDatabase();
});

// Configuración de WebSocket
io.on('connection', (socket) => {
  console.log('Cliente conectado al WebSocket.');
  socket.on('disconnect', () => {
    console.log('Cliente desconectado.');
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
