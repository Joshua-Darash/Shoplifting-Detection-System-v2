from flask import Flask, render_template, request, send_from_directory, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS  # For CORS support
import cv2
import threading
import base64
import time
import numpy as np
from keras.models import load_model
from queue import Queue
import logging
import os
import sqlite3
from datetime import datetime
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask without static_folder initially
app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'Uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
DB_PATH = os.path.join(os.path.dirname(__file__), 'db', 'sldv2.db')
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB limit
ALLOWED_EXTENSIONS = {'.mp4', '.avi', '.mov'}

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), 'config', '.env'))

# Determine environment from FLASK_ENV (default to production)
ENVIRONMENT = os.getenv('FLASK_ENV', 'production')
IS_DEVELOPMENT = ENVIRONMENT == 'development'

# Load the pre-trained model
try:
    model = load_model(os.path.join(os.path.dirname(__file__), 'models', 'LRCN_model___Date_Time_2025_01_28__21_19_11___Loss_0.5761117339134216___Accuracy_0.739130437374115.h5'))
    logger.info("Model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    exit(1)

# Model and video settings
SEQUENCE_LENGTH = 20
FRAME_RATE = 30

# Validate model input shape
expected_shape = (None, SEQUENCE_LENGTH, 64, 64, 3)
if model.input_shape != expected_shape:
    logger.error(f"Model input shape mismatch. Expected {expected_shape}, got {model.input_shape}")
    exit(1)
else:
    logger.info("Model input shape is correct.")

# Global variables
detection_queue = Queue()
detection_lock = threading.Lock()
detection_frame_count = 0
current_source = 'webcam'
uploaded_video_path = None
frame_buffer = []
latest_frame = None

# Database functions
def db_execute(query, params=()):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.lastrowid if 'INSERT' in query.upper() else None

def db_fetch(query, params=()):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchall()

# Load settings from database
def get_settings():
    settings = db_fetch("SELECT * FROM Settings WHERE setting_id=1")
    if not settings:
        db_execute("INSERT INTO Settings (setting_id, email_enabled, sms_enabled, clip_capture_enabled, clip_duration_seconds, cooldown_seconds, logging_enabled) VALUES (1, 0, 0, 0, 6.0, 60, 1)")
        settings = db_fetch("SELECT * FROM Settings WHERE setting_id=1")
    return settings[0]

settings = get_settings()
enable_clip_capture = bool(settings['clip_capture_enabled'])
enable_email_notifications = bool(settings['email_enabled'])
enable_sms_notifications = bool(settings['sms_enabled'])
CLIP_DURATION = float(settings['clip_duration_seconds'])
NOTIFICATION_COOLDOWN = int(settings['cooldown_seconds'])
enable_logging = bool(settings['logging_enabled'])
MAX_BUFFER_SIZE = int(CLIP_DURATION * FRAME_RATE)

# Notification configuration
EMAIL_HOST = os.getenv('EMAIL_HOST')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USER = os.getenv('EMAIL_USER')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD')
EMAIL_RECIPIENTS = [email.strip() for email in os.getenv('EMAIL_RECIPIENTS', '').split(',') if email.strip()]
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
RECIPIENT_PHONE_NUMBER = os.getenv('RECIPIENT_PHONE_NUMBER', '').strip()
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

notification_lock = threading.Lock()

# Conditional configuration based on environment
if IS_DEVELOPMENT:
    # In development mode, enable CORS for all API routes from Vite's dev server
    CORS(app, resources={r"/*": {"origins": "http://localhost:8080"}})
else:
    # In production mode, configure static file serving
    app.static_folder = '../static/build'
    app.static_url_path = '/'
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react_app(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

# Initialize SocketIO with conditional CORS settings
cors_allowed_origins = 'http://localhost:8080' if IS_DEVELOPMENT else '*'
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins=cors_allowed_origins)

# Health check endpoint for development
if IS_DEVELOPMENT:
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "ok", "environment": ENVIRONMENT}), 200

def preprocess_frame(frame):
    if frame is None or frame.size == 0:
        logger.error("Invalid frame received for preprocessing.")
        return None
    frame_resized = cv2.resize(frame, (64, 64))
    frame_normalized = frame_resized.astype('float32') / 255.0
    return frame_normalized

def run_model_on_sequence(sequence):
    sequence_array = np.array(sequence)
    sequence_array = np.expand_dims(sequence_array, axis=0)
    prediction = model.predict(sequence_array)
    return prediction[0][0] < 0.5

def capture_clip(alert_id):
    if not enable_clip_capture or len(frame_buffer) < MAX_BUFFER_SIZE:
        logger.info("Clip not captured: feature disabled or insufficient frames.")
        return None
    clip_frames = frame_buffer[-MAX_BUFFER_SIZE:]
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    clip_path = os.path.join(UPLOAD_FOLDER, f"clip_{timestamp}.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    frame_shape = clip_frames[0].shape[1], clip_frames[0].shape[0]
    out = cv2.VideoWriter(clip_path, fourcc, FRAME_RATE, frame_shape)
    for frame in clip_frames:
        out.write(cv2.resize(frame, frame_shape))
    out.release()
    clip_size = os.path.getsize(clip_path) if os.path.exists(clip_path) else 0
    db_execute("INSERT INTO VideoClips (alert_id, file_path, start_time, duration, size) VALUES (?, ?, ?, ?, ?)",
               (alert_id, clip_path, datetime.now(), CLIP_DURATION, clip_size))
    logger.info(f"Clip saved: {clip_path} ({clip_size} bytes)")
    return clip_path

def send_email_alert(alert_id, message, clip_path=None):
    if not EMAIL_RECIPIENTS:
        logger.warning("No email recipients configured.")
        return
    try:
        msg = MIMEMultipart()
        msg['Subject'] = "Shoplifting Alert"
        msg['From'] = EMAIL_USER
        msg['To'] = ", ".join(EMAIL_RECIPIENTS)
        body = f"Shoplifting detected at {time.ctime()}: {message}"
        msg.attach(MIMEText(body, 'plain'))
        if clip_path and os.path.exists(clip_path):
            with open(clip_path, 'rb') as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename={os.path.basename(clip_path)}')
                msg.attach(part)
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)
        db_execute("INSERT INTO Notifications (alert_id, type, recipient, sent_time, status, message) VALUES (?, ?, ?, ?, ?, ?)",
                   (alert_id, 'email', msg['To'], datetime.now(), 'sent', body))
        db_execute("UPDATE Settings SET last_email_time=? WHERE setting_id=1", (datetime.now(),))
        logger.info("Email alert sent successfully.")
    except Exception as e:
        db_execute("INSERT INTO Notifications (alert_id, type, recipient, sent_time, status, message) VALUES (?, ?, ?, ?, ?, ?)",
                   (alert_id, 'email', msg['To'], datetime.now(), 'failed', body))
        logger.error(f"Failed to send email: {e}")
    finally:
        if clip_path and os.path.exists(clip_path):
            os.remove(clip_path)

def send_sms_alert(alert_id, message):
    if not RECIPIENT_PHONE_NUMBER:
        logger.warning("No SMS recipient configured.")
        return
    try:
        sms_body = f"Shoplifting Alert at {time.ctime()}: {message}"
        twilio_message = twilio_client.messages.create(body=sms_body, from_=TWILIO_PHONE_NUMBER, to=RECIPIENT_PHONE_NUMBER)
        db_execute("INSERT INTO Notifications (alert_id, type, recipient, sent_time, status, message) VALUES (?, ?, ?, ?, ?, ?)",
                   (alert_id, 'sms', RECIPIENT_PHONE_NUMBER, datetime.now(), 'sent', sms_body))
        db_execute("UPDATE Settings SET last_sms_time=? WHERE setting_id=1", (datetime.now(),))
        logger.info(f"SMS alert sent successfully: SID {twilio_message.sid}")
    except TwilioRestException as e:
        db_execute("INSERT INTO Notifications (alert_id, type, recipient, sent_time, status, message) VALUES (?, ?, ?, ?, ?, ?)",
                   (alert_id, 'sms', RECIPIENT_PHONE_NUMBER, datetime.now(), 'failed', sms_body))
        logger.error(f"Failed to send SMS: {e}")

def can_send_notification(notif_type):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT last_{notif_type}_time FROM Settings WHERE setting_id=1")
        last_time = cursor.fetchone()[0]
        current_time = time.time()
        if not last_time or (current_time - time.mktime(datetime.strptime(last_time, '%Y-%m-%d %H:%M:%S').timetuple()) >= NOTIFICATION_COOLDOWN):
            return True
    return False

def allowed_file(filename):
    return os.path.splitext(filename)[1].lower() in ALLOWED_EXTENSIONS

def video_processing():
    global detection_frame_count, current_source, uploaded_video_path, latest_frame
    sequence_buffer = []
    cap = None
    current_cap_source = None

    while True:
        if current_source == 'upload' and uploaded_video_path:
            if current_cap_source != 'upload':
                if cap: cap.release()
                cap = cv2.VideoCapture(uploaded_video_path)
                current_cap_source = 'upload'
                sequence_buffer.clear()
                if enable_clip_capture: frame_buffer.clear()
        else:
            if current_cap_source != 'webcam':
                if cap: cap.release()
                cap = cv2.VideoCapture(0)
                current_cap_source = 'webcam'
                sequence_buffer.clear()
                if enable_clip_capture: frame_buffer.clear()

        if not cap.isOpened():
            logger.warning("Video capture not opened. Retrying...")
            time.sleep(0.1)
            continue

        ret, frame = cap.read()
        if not ret:
            if current_cap_source == 'upload':
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            logger.warning("Failed to read frame. Retrying...")
            time.sleep(0.1)
            continue

        latest_frame = frame.copy()
        if enable_clip_capture:
            frame_buffer.append(frame.copy())
            if len(frame_buffer) > MAX_BUFFER_SIZE:
                frame_buffer.pop(0)

        processed_frame = preprocess_frame(frame)
        if processed_frame is not None:
            sequence_buffer.append(processed_frame)
            if len(sequence_buffer) == SEQUENCE_LENGTH:
                detection_queue.put(sequence_buffer.copy())
                sequence_buffer.clear()

        with detection_lock:
            display_text = detection_frame_count > 0
            if display_text: detection_frame_count -= 1

        if display_text:
            cv2.putText(frame, "Shoplifting Detected!", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        ret, buffer = cv2.imencode('.jpg', frame)
        if ret:
            socketio.emit('frame', {'image': base64.b64encode(buffer).decode('utf-8')})

        time.sleep(1/30)

def detection_worker():
    global detection_frame_count
    while True:
        sequence = detection_queue.get()
        if sequence is None:
            break
        try:
            if run_model_on_sequence(sequence):
                with detection_lock:
                    detection_frame_count = 20
                alert_message = "Suspicious activity detected!"
                socketio.emit('alert', {'message': alert_message})
                if enable_logging:
                    alert_id = db_execute("INSERT INTO Alerts (timestamp, confidence, source, status, details, model_version) VALUES (?, ?, ?, ?, ?, ?)",
                                          (datetime.now(), 0.5, current_source, 'new', alert_message, '1.0'))
                    db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("alert_detected", f"Alert ID: {alert_id}"))
                    clip_path = capture_clip(alert_id)
                    if (enable_email_notifications or enable_sms_notifications):
                        if enable_email_notifications and can_send_notification('email'):
                            send_email_alert(alert_id, alert_message, clip_path)
                        if enable_sms_notifications and can_send_notification('sms'):
                            send_sms_alert(alert_id, alert_message)
                    else:
                        logger.info("Notifications disabled.")
                        if clip_path and os.path.exists(clip_path):
                            os.remove(clip_path)
                else:
                    logger.info("Alert detected but logging is paused")
        except Exception as e:
            logger.error(f"Detection error: {e}")
        finally:
            detection_queue.task_done()

@app.route('/upload_video', methods=['POST'])
def upload_video():
    global uploaded_video_path
    
    # Check if file is included in request
    if 'video' not in request.files:
        logger.error("No video file provided in request")
        return jsonify({"error": "No video file provided"}), 400
    
    file = request.files['video']
    
    # Check for empty filename
    if file.filename == '':
        logger.error("No file selected")
        return jsonify({"error": "No file selected"}), 400
    
    # Validate file type
    if not allowed_file(file.filename):
        logger.error(f"Unsupported file type: {file.filename}")
        return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 415
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    if file_size > MAX_UPLOAD_SIZE:
        logger.error(f"File too large: {file_size} bytes, max allowed: {MAX_UPLOAD_SIZE} bytes")
        return jsonify({"error": f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB"}), 413
    file.seek(0)  # Reset file pointer
    
    # Secure filename and save file
    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    try:
        file.save(file_path)
        uploaded_video_path = file_path
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("video_upload", f"Uploaded {filename}"))
        logger.info(f"Video uploaded: {file_path}")
        return jsonify({"message": "Video uploaded successfully", "filename": filename}), 200
    except Exception as e:
        logger.error(f"Failed to save video file: {str(e)}")
        return jsonify({"error": "Failed to save video file. Please try again."}), 500

@socketio.on('set_source')
def set_source(data):
    global current_source
    source = data['source']
    current_source = 'uploaded' if source == 'upload' else 'webcam'
    db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_source", f"Source set to {current_source}"))
    logger.info(f"Setting source to {current_source}")

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected")
    socketio.emit('notification_status', {
        'email': enable_email_notifications,
        'sms': enable_sms_notifications,
        'clip': enable_clip_capture,
        'clip_duration': CLIP_DURATION,
        'logging': enable_logging
    })
    logs = db_fetch("SELECT timestamp, details FROM Alerts ORDER BY timestamp DESC LIMIT 20")
    socketio.emit('alert_logs', [{'timestamp': row['timestamp'], 'details': row['details']} for row in logs])

@socketio.on('toggle_notifications')
def toggle_notifications(data):
    global enable_email_notifications, enable_sms_notifications
    if 'email' in data:
        enable_email_notifications = data['email']
        db_execute("UPDATE Settings SET email_enabled=?, last_updated=? WHERE setting_id=1",
                   (int(data['email']), datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("toggle_email", f"Email set to {data['email']}"))
        logger.info(f"Email notifications {'enabled' if enable_email_notifications else 'disabled'}")
    if 'sms' in data:
        enable_sms_notifications = data['sms']
        db_execute("UPDATE Settings SET sms_enabled=?, last_updated=? WHERE setting_id=1",
                   (int(data['sms']), datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("toggle_sms", f"SMS set to {data['sms']}"))
        logger.info(f"SMS notifications {'enabled' if enable_sms_notifications else 'disabled'}")
    socketio.emit('notification_status', {
        'email': enable_email_notifications,
        'sms': enable_sms_notifications,
        'clip': enable_clip_capture,
        'clip_duration': CLIP_DURATION,
        'logging': enable_logging
    })

@socketio.on('toggle_clip_capture')
def toggle_clip_capture(data):
    global enable_clip_capture
    if 'clip' in data:
        enable_clip_capture = data['clip']
        db_execute("UPDATE Settings SET clip_capture_enabled=?, last_updated=? WHERE setting_id=1",
                   (int(data['clip']), datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("toggle_clip", f"Clip capture set to {data['clip']}"))
        if not enable_clip_capture:
            frame_buffer.clear()
        logger.info(f"Clip capture {'enabled' if enable_clip_capture else 'disabled'}")
        socketio.emit('notification_status', {
            'email': enable_email_notifications,
            'sms': enable_sms_notifications,
            'clip': enable_clip_capture,
            'clip_duration': CLIP_DURATION,
            'logging': enable_logging
        })

@socketio.on('set_clip_duration')
def set_clip_duration(data):
    global CLIP_DURATION, MAX_BUFFER_SIZE
    if 'duration' in data and isinstance(data['duration'], (int, float)) and data['duration'] > 0 and data['duration'] <= 1800:
        CLIP_DURATION = float(data['duration'])
        MAX_BUFFER_SIZE = int(CLIP_DURATION * FRAME_RATE)
        db_execute("UPDATE Settings SET clip_duration_seconds=?, last_updated=? WHERE setting_id=1",
                   (CLIP_DURATION, datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("set_clip_duration", f"Clip duration set to {CLIP_DURATION} seconds"))
        logger.info(f"Clip duration updated to {CLIP_DURATION} seconds")
        socketio.emit('notification_status', {
            'email': enable_email_notifications,
            'sms': enable_sms_notifications,
            'clip': enable_clip_capture,
            'clip_duration': CLIP_DURATION,
            'logging': enable_logging
        })

@socketio.on('capture_snapshot')
def capture_snapshot():
    global latest_frame
    if latest_frame is not None:
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        file_path = os.path.join(UPLOAD_FOLDER, f"snapshot_{timestamp}.jpg")
        cv2.imwrite(file_path, latest_frame)
        snapshot_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        db_execute("INSERT INTO Snapshots (file_path, timestamp, size) VALUES (?, ?, ?)",
                   (file_path, datetime.now(), snapshot_size))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("snapshot", f"Saved to {file_path} ({snapshot_size} bytes)"))
        logger.info(f"Snapshot saved: {file_path}")

@socketio.on('update_alert')
def update_alert(data):
    alert_id = data.get('alert_id')
    status = data.get('status')
    notes = data.get('notes', '')
    if alert_id and status in ['new', 'processed', 'dismissed']:
        db_execute("UPDATE Alerts SET status=?, notes=?, last_updated=? WHERE alert_id=?",
                   (status, notes, datetime.now(), alert_id))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("update_alert", f"Alert {alert_id} updated to {status} with notes: {notes}"))
        logger.info(f"Alert {alert_id} updated to {status}")
    else:
        logger.warning("Invalid update_alert data")

@socketio.on('toggle_logging')
def toggle_logging(data):
    global enable_logging
    if 'logging_enabled' in data:
        enable_logging = bool(data['logging_enabled'])
        db_execute("UPDATE Settings SET logging_enabled=?, last_updated=? WHERE setting_id=1",
                   (int(enable_logging), datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("toggle_logging", f"Logging set to {enable_logging}"))
        logger.info(f"Alert logging {'enabled' if enable_logging else 'disabled'}")
        socketio.emit('notification_status', {
            'email': enable_email_notifications,
            'sms': enable_sms_notifications,
            'clip': enable_clip_capture,
            'clip_duration': CLIP_DURATION,
            'logging': enable_logging
        })

detection_thread = threading.Thread(target=detection_worker, daemon=True)
detection_thread.start()

video_thread = threading.Thread(target=video_processing, daemon=True)
video_thread.start()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)