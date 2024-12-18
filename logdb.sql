-- Crear base de datos logdb
CREATE DATABASE IF NOT EXISTS logdb;

-- Usar la base de datos logdb
USE logdb;

CREATE TABLE command_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    command TEXT NOT NULL,
    client_ip VARCHAR(45) NOT NULL, -- IPv4 o IPv6
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
