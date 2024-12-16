DROP DATABASE testdb;

CREATE DATABASE IF NOT EXISTS testdb;

USE testdb;

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(15),
    hire_date DATE NOT NULL,
    job_title VARCHAR(50) NOT NULL,
    department_id INT,
    salary DECIMAL(10, 2) NOT NULL,
    manager_id INT,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    budget DECIMAL(15, 2) NOT NULL,
    department_id INT,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    due_date DATE,
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    project_id INT,
    assigned_to INT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    status ENUM('Present', 'Absent', 'On Leave') DEFAULT 'Present',
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

INSERT INTO departments (name, location) VALUES 
    ('Human Resources', 'New York'),
    ('Engineering', 'San Francisco'),
    ('Sales', 'Chicago'),
    ('Marketing', 'Los Angeles');

INSERT INTO employees (first_name, last_name, email, phone_number, hire_date, job_title, department_id, salary, manager_id) VALUES
    ('Alice', 'Johnson', 'alice.johnson@example.com', '123-456-7890', '2020-05-10', 'HR Manager', 1, 75000, NULL),
    ('Bob', 'Smith', 'bob.smith@example.com', '987-654-3210', '2019-03-15', 'Software Engineer', 2, 85000, NULL),
    ('Charlie', 'Brown', 'charlie.brown@example.com', '456-789-0123', '2021-06-20', 'Sales Manager', 3, 65000, NULL),
    ('Diana', 'Ross', 'diana.ross@example.com', '321-654-9870', '2018-01-25', 'Marketing Specialist', 4, 55000, NULL);

INSERT INTO projects (name, description, start_date, end_date, budget, department_id) VALUES
    ('Project Apollo', 'Engineering initiative for new product', '2023-01-01', '2023-12-31', 1500000, 2),
    ('Sales Expansion', 'Increase market presence', '2023-04-01', '2023-10-31', 500000, 3),
    ('Brand Refresh', 'Rebrand marketing materials', '2023-06-01', '2023-11-30', 200000, 4);

INSERT INTO tasks (name, description, start_date, due_date, status, project_id, assigned_to) VALUES
    ('Prototype Design', 'Create initial prototype', '2023-01-15', '2023-03-15', 'In Progress', 1, 2),
    ('Market Research', 'Analyze competitor data', '2023-04-01', '2023-06-30', 'Pending', 2, 3),
    ('Logo Redesign', 'Design a new logo', '2023-07-01', '2023-08-15', 'Pending', 3, 4);

INSERT INTO attendance (employee_id, date, check_in_time, check_out_time, status) VALUES
    (1, '2023-07-01', '09:00:00', '17:00:00', 'Present'),
    (2, '2023-07-01', '09:15:00', '18:00:00', 'Present'),
    (3, '2023-07-01', NULL, NULL, 'Absent'),
    (4, '2023-07-01', '09:30:00', '16:45:00', 'Present');
