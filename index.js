require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Configuración de conexiones
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'aMandATecARt',
  database: 'testdb'
});

const logPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'IsMyColor2244*+',
  database: 'logdb',
});

// Verificar conexión a testdb
const testDBConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión a la base de datos "testdb" establecida correctamente.');
    connection.release();
  } catch (error) {
    console.error('Error al conectar con la base de datos "testdb":', error.message);
  }
};

// Verificar conexión a logdb
const logDBConnection = async () => {
  try {
    const connection = await logPool.getConnection();
    console.log('Conexión a la base de datos "logdb" establecida correctamente.');
    connection.release();
  } catch (error) {
    console.error('Error al conectar con la base de datos "logdb":', error.message);
  }
};

// Probar conexiones al inicio
testDBConnection();
logDBConnection();

// Función para ejecutar SQL
const executeMultiQuery = async (connection, sql) => {
  const queries = sql.split(';').filter(query => query.trim());
  for (const query of queries) {
    await connection.query(query);
  }
};

// Función para log de comandos
const logCommand = async (command) => {
  const connection = await logPool.getConnection();
  try {
    await connection.query(
      'INSERT INTO command_logs (command, executed_at) VALUES (?, NOW())',
      [command]
    );
  } finally {
    connection.release();
  }
};

// Restablecer la base de datos
const resetDatabase = async () => {
  const sqlFilePath = path.join(__dirname, 'testdb.sql');

  try {
    const sqlQuery = fs.readFileSync(sqlFilePath, 'utf-8');
    const connection = await pool.getConnection();

    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
      await executeMultiQuery(connection, sqlQuery);
      await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
      console.log('Base de datos restablecida correctamente.');
      io.emit('schema-updated', { message: 'Base de datos restablecida.' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error al restablecer la base de datos:', error.message);
  }
};

// Escuchar comandos SQL
app.post('/execute-query', async (req, res) => {
  const { query } = req.body;

  try {
    if (/DROP|DELETE/i.test(query)) {
      console.warn('Comando DROP/DELETE detectado, restableciendo base de datos...');
      await logCommand(query);
      await resetDatabase();
    } else {
      const [rows] = await pool.query(query);
      await logCommand(query);
      res.json({ data: rows });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Esquema de la base de datos
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

// Configurar cron para restablecer cada 24 horas
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
