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

// Función para probar la conexión a una base de datos
const testDBConnection = async (pool, dbName) => {
  try {
    const connection = await pool.getConnection();
    console.log(`Conexión a la base de datos "${dbName}" establecida correctamente.`);
    connection.release();
  } catch (error) {
    console.error(`Error al conectar con la base de datos "${dbName}":`, error.message);
  }
};

// Configuración de conexiones a las bases de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST || '172.18.0.2',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'aMandATecARt',
  database: process.env.DB_NAME || 'testdb',
  multipleStatements: true // Permite ejecutar múltiples sentencias separadas por ";"
});

const logPool = mysql.createPool({
  host: process.env.LOG_DB_HOST || '172.18.0.3',
  user: process.env.LOG_DB_USER || 'root',
  password: process.env.LOG_DB_PASSWORD || 'IsMyColor2244*+',
  database: process.env.LOG_DB_NAME || 'logdb'
});

// Verificar conexiones a las bases de datos al inicio
(async () => {
  await testDBConnection(pool, 'testdb');
  await testDBConnection(logPool, 'logdb');
})();

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

// Función para obtener y emitir el esquema actual
const emitSchema = async () => {
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
};

// Ruta para ejecutar una o varias consultas SQL
app.post('/execute-query', async (req, res) => {
  const { query } = req.body;
  const clientIp = req.ip; // Obtener la IP del cliente
  
  // Separar las consultas por ";", filtrando las vacías
  const queries = query
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0);
  
  const results = [];
  try {
    for (const singleQuery of queries) {
      // Verificar si la consulta contiene DROP DATABASE o DELETE DATABASE
      if (/DROP\s+DATABASE|DELETE\s+DATABASE/i.test(singleQuery)) {
        console.warn('Comando DROP/DELETE de la BBDD detectado, restableciendo base de datos...');
        await logCommand(singleQuery, clientIp); // Log del comando
        return res.status(400).json({ error: 'Comando DROP/DELETE no permitido.' });
      }
      
      const [rows] = await pool.query(singleQuery);
      await logCommand(singleQuery, clientIp); // Log del comando
      results.push(rows);
    }
    
    // Después de ejecutar las consultas, emitir el esquema actualizado
    await emitSchema();
    
    // Si se ejecutaron múltiples sentencias, devolvemos un array de resultados
    // Si fue una sola, seguirá siendo un array con un único elemento.
    res.json({ data: results.length === 1 ? results[0] : results });
  } catch (error) {
    console.error('Error al ejecutar consulta SQL:', error.message);
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
    console.error('Error al obtener el esquema de la base de datos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Función hipotética para restablecer la base de datos
const resetDatabase = async () => {
  // Aquí iría la lógica para restaurar la BBDD
  // Por ejemplo, ejecutando un script SQL de restauración.
};

// Configurar cron para restablecer la base de datos cada 24 horas
cron.schedule('0 0 * * *', async () => {
  console.log('Restableciendo base de datos cada 24 horas...');
  await resetDatabase();
  await emitSchema();
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
