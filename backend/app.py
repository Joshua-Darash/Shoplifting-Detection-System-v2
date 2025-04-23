from flask import Flask, render_template, request, send_from_directory, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
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
current_camera_id = None
uploaded_video_path = None
frame_buffer = []
latest_frame = None

# Database functions
def db_execute(query, params=()):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.lastrowid if 'INSERT' in query.upper() else None
    except Exception as e:
        logger.error(f"Database execute error: {e}")
        raise

def db_fetch(query, params=()):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Database fetch error: {e}")
        raise

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
    CORS(app, resources={r"/*": {"origins": "http://localhost:8080"}})
else:
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

# Serve uploaded files (snapshots, clips)
@app.route('/Uploads/<filename>')
def serve_upload(filename):
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except Exception as e:
        logger.error(f"Error serving file {filename}: {e}")
        return jsonify({"error": "File not found"}), 404

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
    confidence = float(prediction[0][0])
    return confidence < 0.5, confidence

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
        db_execute("UPDATE Settings SET last_email_time=? WHERE setting_id=1", (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),))
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
        db_execute("UPDATE Settings SET last_sms_time=? WHERE setting_id=1", (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),))
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
        if not last_time:
            return True
        last_time_dt = datetime.strptime(last_time, '%Y-%m-%d %H:%M:%S')
        current_time = datetime.now()
        return (current_time - last_time_dt).total_seconds() >= NOTIFICATION_COOLDOWN

def allowed_file(filename):
    return os.path.splitext(filename)[1].lower() in ALLOWED_EXTENSIONS

def video_processing():
    global detection_frame_count, current_source, current_camera_id, uploaded_video_path, latest_frame
    sequence_buffer = []
    cap = None
    current_cap_source = None

    while True:
        try:
            if current_source == 'upload' and uploaded_video_path:
                if current_cap_source != 'upload':
                    if cap:
                        cap.release()
                    cap = cv2.VideoCapture(uploaded_video_path)
                    current_cap_source = 'upload'
                    sequence_buffer.clear()
                    if enable_clip_capture:
                        frame_buffer.clear()
            else:
                if current_cap_source != 'webcam':
                    if cap:
                        cap.release()
                    cap = cv2.VideoCapture(0)  # TODO: Use current_camera_id when Cameras table is implemented
                    current_cap_source = 'webcam'
                    sequence_buffer.clear()
                    if enable_clip_capture:
                        frame_buffer.clear()

            if not cap or not cap.isOpened():
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

            with detection_lock:
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
                if display_text:
                    detection_frame_count -= 1

            if display_text:
                cv2.putText(frame, "Shoplifting Detected!", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                socketio.emit('frame', {'image': base64.b64encode(buffer).decode('utf-8')})
            else:
                logger.error("Failed to encode frame as JPEG")

            time.sleep(1/30)
        except Exception as e:
            logger.error(f"Video processing error: {e}")
            time.sleep(0.1)

def detection_worker():
    global detection_frame_count
    last_alert_time = 0
    while True:
        sequence = detection_queue.get()
        if sequence is None:
            break
        try:
            is_shoplifting, confidence = run_model_on_sequence(sequence)
            current_time = time.time()
            if is_shoplifting and (current_time - last_alert_time) >= NOTIFICATION_COOLDOWN:
                with detection_lock:
                    detection_frame_count = 20
                alert_message = "Suspicious activity detected!"
                socketio.emit('alert', {
                    'message': alert_message,
                    'confidence': confidence,
                    'source': current_source,
                    'camera_id': current_camera_id
                })
                if enable_logging:
                    alert_id = db_execute(
                        "INSERT INTO Alerts (timestamp, confidence, source, status, details, model_version, camera_id, read, is_false_positive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (datetime.now(), confidence, current_source, 'new', alert_message, '1.0', current_camera_id, 0, 0)
                    )
                    db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("alert_detected", f"Alert ID: {alert_id}"))
                    clip_path = capture_clip(alert_id)
                    if enable_email_notifications or enable_sms_notifications:
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
                last_alert_time = current_time
        except Exception as e:
            logger.error(f"Detection error: {e}")
        finally:
            detection_queue.task_done()

@app.route('/upload_video', methods=['POST'])
def upload_video():
    global uploaded_video_path
    if 'video' not in request.files:
        logger.error("No video file provided in request")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("upload_failed", "No video file provided"))
        return jsonify({"error": "No video file provided"}), 400

    file = request.files['video']
    if file.filename == '':
        logger.error("No file selected")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("upload_failed", "No file selected"))
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        logger.error(f"Unsupported file type: {file.filename}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("upload_failed", f"Unsupported file type: {file.filename}"))
        return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 415

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    if file_size > MAX_UPLOAD_SIZE:
        logger.error(f"File too large: {file_size} bytes")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("upload_failed", f"File too large: {file_size} bytes"))
        return jsonify({"error": f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB"}), 413
    file.seek(0)

    filename = secure_filename(f"{time.strftime('%Y%m%d-%H%M%S')}_{file.filename}")
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    try:
        file.save(file_path)
        uploaded_video_path = file_path
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("video_upload", f"Uploaded {filename}"))
        logger.info(f"Video uploaded: {file_path}")
        return jsonify({"message": "Video uploaded successfully", "filename": filename}), 200
    except Exception as e:
        logger.error(f"Failed to save video file: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("upload_failed", f"Failed to save {filename}: {e}"))
        return jsonify({"error": "Failed to save video file. Please try again."}), 500

@socketio.on('set_source')
def set_source(data):
    global current_source, current_camera_id
    try:
        source = data.get('source')
        camera_id = data.get('camera_id')
        if source not in ['webcam', 'upload']:
            logger.error(f"Invalid source: {source}")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_source_failed", f"Invalid source: {source}"))
            return
        current_source = source
        current_camera_id = camera_id if camera_id is not None else None
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_source", f"Source set to {current_source}, camera_id: {current_camera_id}"))
        logger.info(f"Setting source to {current_source}, camera_id: {current_camera_id}")
    except Exception as e:
        logger.error(f"Error setting source: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_source_failed", f"Error: {e}"))

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected")
    socketio.emit('notification_status', {
        'email_enabled': enable_email_notifications,
        'sms_enabled': enable_sms_notifications,
        'clip_capture_enabled': enable_clip_capture,
        'clip_duration_seconds': CLIP_DURATION,
        'logging_enabled': enable_logging,
        'cooldown_seconds': NOTIFICATION_COOLDOWN
    })
    logs = db_fetch("""
        SELECT a.alert_id, a.timestamp, a.details, a.source, a.confidence, a.camera_id, 
               CASE WHEN vc.file_path IS NOT NULL THEN '/Uploads/' || vc.file_path ELSE NULL END AS clip_url
        FROM Alerts a
        LEFT JOIN VideoClips vc ON a.alert_id = vc.alert_id
        ORDER BY a.timestamp DESC LIMIT 20
    """)
    socketio.emit('alert_logs', [{
        'alert_id': row['alert_id'],
        'timestamp': row['timestamp'],
        'details': row['details'],
        'source': row['source'],
        'confidence': float(row['confidence']),
        'camera_id': row['camera_id'],
        'clip_url': row['clip_url']
    } for row in logs])

@socketio.on('clear_alerts')
def clear_alerts():
    try:
        db_execute("DELETE FROM Alerts")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("clear_alerts", "All alerts deleted"))
        logger.info("All alerts cleared from database")
    except Exception as e:
        logger.error(f"Error clearing alerts: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("clear_alerts_failed", f"Error: {e}"))

@socketio.on('toggle_notifications')
def toggle_notifications(data):
    global enable_email_notifications, enable_sms_notifications
    try:
        notification_type = data.get('type')
        enabled = data.get('enabled')
        if notification_type not in ['email', 'sms'] or not isinstance(enabled, bool):
            logger.error(f"Invalid toggle_notifications data: {data}")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("toggle_notifications_failed", f"Invalid data: {data}"))
            return
        if notification_type == 'email':
            enable_email_notifications = enabled
            db_execute("UPDATE Settings SET email_enabled=?, last_updated=? WHERE setting_id=1",
                       (int(enabled), datetime.now()))
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                       ("toggle_email", f"Email set to {enabled}"))
            logger.info(f"Email notifications {'enabled' if enabled else 'disabled'}")
        elif notification_type == 'sms':
            enable_sms_notifications = enabled
            db_execute("UPDATE Settings SET sms_enabled=?, last_updated=? WHERE setting_id=1",
                       (int(enabled), datetime.now()))
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                       ("toggle_sms", f"SMS set to {enabled}"))
            logger.info(f"SMS notifications {'enabled' if enabled else 'disabled'}")
        socketio.emit('notification_status', {
            'email_enabled': enable_email_notifications,
            'sms_enabled': enable_sms_notifications,
            'clip_capture_enabled': enable_clip_capture,
            'clip_duration_seconds': CLIP_DURATION,
            'logging_enabled': enable_logging,
            'cooldown_seconds': NOTIFICATION_COOLDOWN
        })
    except Exception as e:
        logger.error(f"Error toggling notifications: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("toggle_notifications_failed", f"Error: {e}"))

@socketio.on('toggle_clip_capture')
def toggle_clip_capture(data):
    global enable_clip_capture
    try:
        enabled = data.get('enabled')
        if not isinstance(enabled, bool):
            logger.error(f"Invalid toggle_clip_capture data: {data}")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("toggle_clip_failed", f"Invalid data: {data}"))
            return
        enable_clip_capture = enabled
        db_execute("UPDATE Settings SET clip_capture_enabled=?, last_updated=? WHERE setting_id=1",
                   (int(enabled), datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("toggle_clip", f"Clip capture set to {enabled}"))
        if not enable_clip_capture:
            with detection_lock:
                frame_buffer.clear()
        logger.info(f"Clip capture {'enabled' if enabled else 'disabled'}")
        socketio.emit('notification_status', {
            'email_enabled': enable_email_notifications,
            'sms_enabled': enable_sms_notifications,
            'clip_capture_enabled': enable_clip_capture,
            'clip_duration_seconds': CLIP_DURATION,
            'logging_enabled': enable_logging,
            'cooldown_seconds': NOTIFICATION_COOLDOWN
        })
    except Exception as e:
        logger.error(f"Error toggling clip capture: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("toggle_clip_failed", f"Error: {e}"))

@socketio.on('set_clip_duration')
def set_clip_duration(data):
    global CLIP_DURATION, MAX_BUFFER_SIZE
    try:
        duration = data.get('duration')
        if not isinstance(duration, (int, float)) or duration <= 0 or duration > 1800:
            logger.error(f"Invalid clip duration: {duration}")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_clip_duration_failed", f"Invalid duration: {duration}"))
            return
        CLIP_DURATION = float(duration)
        MAX_BUFFER_SIZE = int(CLIP_DURATION * FRAME_RATE)
        db_execute("UPDATE Settings SET clip_duration_seconds=?, last_updated=? WHERE setting_id=1",
                   (CLIP_DURATION, datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("set_clip_duration", f"Clip duration set to {CLIP_DURATION} seconds"))
        logger.info(f"Clip duration updated to {CLIP_DURATION} seconds")
        socketio.emit('notification_status', {
            'email_enabled': enable_email_notifications,
            'sms_enabled': enable_sms_notifications,
            'clip_capture_enabled': enable_clip_capture,
            'clip_duration_seconds': CLIP_DURATION,
            'logging_enabled': enable_logging,
            'cooldown_seconds': NOTIFICATION_COOLDOWN
        })
    except Exception as e:
        logger.error(f"Error setting clip duration: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_clip_duration_failed", f"Error: {e}"))

@socketio.on('set_cooldown_duration')
def set_cooldown_duration(data):
    global NOTIFICATION_COOLDOWN
    try:
        cooldown = data.get('cooldown')
        if not isinstance(cooldown, (int, float)) or cooldown < 0 or cooldown > 300:
            logger.error(f"Invalid cooldown duration: {cooldown}")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_cooldown_failed", f"Invalid cooldown: {cooldown}"))
            return
        NOTIFICATION_COOLDOWN = int(cooldown)
        db_execute("UPDATE Settings SET cooldown_seconds=?, last_updated=? WHERE setting_id=1",
                   (NOTIFICATION_COOLDOWN, datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("set_cooldown", f"Cooldown duration set to {NOTIFICATION_COOLDOWN} seconds"))
        logger.info(f"Cooldown duration updated to {NOTIFICATION_COOLDOWN} seconds")
        socketio.emit('notification_status', {
            'email_enabled': enable_email_notifications,
            'sms_enabled': enable_sms_notifications,
            'clip_capture_enabled': enable_clip_capture,
            'clip_duration_seconds': CLIP_DURATION,
            'logging_enabled': enable_logging,
            'cooldown_seconds': NOTIFICATION_COOLDOWN
        })
    except Exception as e:
        logger.error(f"Error setting cooldown duration: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("set_cooldown_failed", f"Error: {e}"))

@socketio.on('capture_snapshot')
def capture_snapshot():
    global latest_frame
    try:
        if latest_frame is None or latest_frame.size == 0:
            logger.error("No valid frame available for snapshot")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("snapshot_failed", "No valid frame"))
            return
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        file_path = os.path.join(UPLOAD_FOLDER, f"snapshot_{timestamp}.jpg")
        if cv2.imwrite(file_path, latest_frame):
            snapshot_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            db_execute("INSERT INTO Snapshots (file_path, timestamp, size) VALUES (?, ?, ?)",
                       (file_path, datetime.now(), snapshot_size))
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                       ("snapshot", f"Saved to {file_path} ({snapshot_size} bytes)"))
            socketio.emit('snapshot', {'file_path': f"/Uploads/snapshot_{timestamp}.jpg"})
            logger.info(f"Snapshot saved: {file_path}")
        else:
            logger.error("Failed to save snapshot")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("snapshot_failed", "Failed to save snapshot"))
    except Exception as e:
        logger.error(f"Error capturing snapshot: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("snapshot_failed", f"Error: {e}"))

@socketio.on('update_alert')
def update_alert(data):
    try:
        alert_id = data.get('alert_id')
        status = data.get('status')
        notes = data.get('notes', '')
        read = data.get('read', None)
        is_false_positive = data.get('is_false_positive', None)

        if not alert_id:
            logger.error(f"Invalid update_alert data: missing alert_id")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("update_alert_failed", f"Missing alert_id: {data}"))
            return

        if status == 'dismissed':
            db_execute("DELETE FROM Alerts WHERE alert_id=?", (alert_id,))
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                       ("dismiss_alert", f"Alert {alert_id} deleted"))
            logger.info(f"Alert {alert_id} dismissed and deleted")
            return

        if status not in ['new', 'processed'] or (notes and len(notes) > 500) or \
           (read is not None and not isinstance(read, bool)) or \
           (is_false_positive is not None and not isinstance(is_false_positive, bool)):
            logger.error(f"Invalid update_alert data: {data}")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("update_alert_failed", f"Invalid data: {data}"))
            return

        update_fields = []
        update_params = []
        if status:
            update_fields.append("status=?")
            update_params.append(status)
        if notes is not None:
            update_fields.append("notes=?")
            update_params.append(notes)
        if read is not None:
            update_fields.append("read=?")
            update_params.append(int(read))
        if is_false_positive is not None:
            update_fields.append("is_false_positive=?")
            update_params.append(int(is_false_positive))
        update_fields.append("last_updated=?")
        update_params.append(datetime.now())
        update_params.append(alert_id)

        if update_fields:
            query = f"UPDATE Alerts SET {', '.join(update_fields)} WHERE alert_id=?"
            db_execute(query, tuple(update_params))
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                       ("update_alert", f"Alert {alert_id} updated: status={status}, notes={notes}, read={read}, is_false_positive={is_false_positive}"))
            logger.info(f"Alert {alert_id} updated: status={status}, read={read}, is_false_positive={is_false_positive}")
    except Exception as e:
        logger.error(f"Error updating alert: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("update_alert_failed", f"Error: {e}"))

@socketio.on('toggle_logging')
def toggle_logging(data):
    global enable_logging
    try:
        enabled = data.get('enabled')
        if not isinstance(enabled, bool):
            logger.error(f"Invalid toggle_logging data: {data}")
            db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("toggle_logging_failed", f"Invalid data: {data}"))
            return
        enable_logging = enabled
        db_execute("UPDATE Settings SET logging_enabled=?, last_updated=? WHERE setting_id=1",
                   (int(enabled), datetime.now()))
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)",
                   ("toggle_logging", f"Logging set to {enabled}"))
        logger.info(f"Alert logging {'enabled' if enabled else 'disabled'}")
        socketio.emit('notification_status', {
            'email_enabled': enable_email_notifications,
            'sms_enabled': enable_sms_notifications,
            'clip_capture_enabled': enable_clip_capture,
            'clip_duration_seconds': CLIP_DURATION,
            'logging_enabled': enable_logging,
            'cooldown_seconds': NOTIFICATION_COOLDOWN
        })
    except Exception as e:
        logger.error(f"Error toggling logging: {e}")
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", ("toggle_logging_failed", f"Error: {e}"))

@socketio.on('log_error')
def log_error(data):
    try:
        action = data.get('action', 'unknown_error')
        details = data.get('details', 'No details provided')
        db_execute("INSERT INTO AuditLog (action, details) VALUES (?, ?)", (action, details))
        logger.info(f"Frontend error logged: {action} - {details}")
    except Exception as e:
        logger.error(f"Error logging frontend error: {e}")

detection_thread = threading.Thread(target=detection_worker, daemon=True)
detection_thread.start()

video_thread = threading.Thread(target=video_processing, daemon=True)
video_thread.start()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)