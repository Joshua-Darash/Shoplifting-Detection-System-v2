-- Cameras table (unchanged)
CREATE TABLE Cameras (
    camera_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    location TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Alerts table (added 'read', 'is_false_positive', and notes length constraint)
CREATE TABLE Alerts (
    alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    source TEXT NOT NULL CHECK (source IN ('webcam', 'uploaded')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processed', 'dismissed')),
    details VARCHAR(255),
    model_version TEXT DEFAULT '1.0',
    camera_id INTEGER,
    notes TEXT CHECK (LENGTH(notes) <= 2000),
    last_updated DATETIME,
    read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
    is_false_positive INTEGER NOT NULL DEFAULT 0 CHECK (is_false_positive IN (0, 1)),
    FOREIGN KEY (camera_id) REFERENCES Cameras(camera_id) ON DELETE SET NULL
);
CREATE INDEX idx_alerts_timestamp ON Alerts(timestamp);
CREATE INDEX idx_alerts_status ON Alerts(status);
CREATE INDEX idx_alerts_timestamp_status ON Alerts(timestamp, status);

-- VideoClips table (unchanged)
CREATE TABLE VideoClips (
    clip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL,
    file_path TEXT NOT NULL UNIQUE CHECK (file_path LIKE '%.mp4'),
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration REAL NOT NULL CHECK (duration > 0),
    size INTEGER CHECK (size >= 0),
    FOREIGN KEY (alert_id) REFERENCES Alerts(alert_id) ON DELETE CASCADE
);
CREATE INDEX idx_videoclips_alert_id ON VideoClips(alert_id);
CREATE INDEX idx_videoclips_start_time ON VideoClips(start_time);

-- Snapshots table (unchanged)
CREATE TABLE Snapshots (
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER,
    file_path TEXT NOT NULL UNIQUE CHECK (file_path LIKE '%.jpg'),
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    size INTEGER CHECK (size >= 0),
    FOREIGN KEY (alert_id) REFERENCES Alerts(alert_id) ON DELETE SET NULL
);
CREATE INDEX idx_snapshots_alert_id ON Snapshots(alert_id);
CREATE INDEX idx_snapshots_timestamp ON Snapshots(timestamp);

-- Notifications table (unchanged)
CREATE TABLE Notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
    recipient TEXT NOT NULL,
    sent_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    message VARCHAR(255),
    FOREIGN KEY (alert_id) REFERENCES Alerts(alert_id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_alert_id ON Notifications(alert_id);
CREATE INDEX idx_notifications_sent_time ON Notifications(sent_time);

-- Settings table (unchanged)
CREATE TABLE Settings (
    setting_id INTEGER PRIMARY KEY CHECK (setting_id = 1),
    email_enabled INTEGER NOT NULL DEFAULT 0 CHECK (email_enabled IN (0, 1)),
    sms_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sms_enabled IN (0, 1)),
    clip_capture_enabled INTEGER NOT NULL DEFAULT 0 CHECK (clip_capture_enabled IN (0, 1)),
    clip_duration_seconds REAL NOT NULL DEFAULT 6.0 CHECK (clip_duration_seconds > 0 AND clip_duration_seconds <= 1800),
    cooldown_seconds INTEGER NOT NULL DEFAULT 60 CHECK (cooldown_seconds >= 0),
    logging_enabled INTEGER NOT NULL DEFAULT 1 CHECK (logging_enabled IN (0, 1)),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_email_time DATETIME,
    last_sms_time DATETIME
);
INSERT INTO Settings (setting_id, email_enabled, sms_enabled, clip_capture_enabled, clip_duration_seconds, cooldown_seconds, logging_enabled)
VALUES (1, 0, 0, 0, 6.0, 60, 1);

-- AuditLog table (unchanged)
CREATE TABLE AuditLog (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    details VARCHAR(255)
);
CREATE INDEX idx_auditlog_timestamp ON AuditLog(timestamp);