require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Conexión a MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'vps.jprcdev.com',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'aMandATecARt',
});

// Función para ejecutar múltiples consultas SQL
const executeMultiQuery = async (connection, sql) => {
  const queries = sql.split(';').filter(query => query.trim());
  for (const query of queries) {
    await connection.query(query);
  }
};

// Función para restablecer la base de datos
const resetDatabase = async () => {
  const sqlFilePath = path.join(__dirname, 'testdb.sql');

  try {
    if (!fs.existsSync(sqlFilePath)) {
      console.error('Archivo testdb.sql no encontrado.');
      return;
    }

    const sqlQuery = fs.readFileSync(sqlFilePath, 'utf-8');
    const connection = await pool.getConnection();

    try {
      // Ejecutar las consultas del archivo SQL
      await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
      await executeMultiQuery(connection, sqlQuery);
      await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
      console.log('Base de datos restablecida correctamente.');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error al restablecer la base de datos:', error.message);
  }
};

// Llamar a la función al iniciar el servidor
resetDatabase();

// Configurar cron job para restablecer cada 24 horas
cron.schedule('0 0 * * *', () => {
  console.log('Restableciendo la base de datos...');
  resetDatabase();
});

// Ruta para ejecutar consultas
app.post('/execute-query', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'La consulta SQL es obligatoria.' });
  }

  try {
    const [rows] = await pool.query(query);
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener la estructura de la base de datos
app.get('/schema', async (req, res) => {
  try {
    const [tables] = await pool.query(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = ?`, 
      [process.env.DB_NAME || 'testdb']
    );

    const schemaDetails = {};
    for (const table of tables) {
      const [columns] = await pool.query(
        `SELECT column_name AS columnName, data_type AS dataType, is_nullable AS isNullable
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?`, 
        [process.env.DB_NAME || 'testdb', table.tableName]
      );
      schemaDetails[table.tableName] = columns;
    }

    res.json({ schema: schemaDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
