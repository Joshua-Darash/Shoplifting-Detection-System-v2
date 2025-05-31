# Shoplifting Detection System  (sld-v2)

The Shoplifting Detection System is a real-time surveillance solution built with a Flask-SocketIO backend and a responsive HTML/JavaScript frontend, designed to detect suspicious activities using a pre-trained Long-term Recurrent Convolutional Network (LRCN) model on video sequences from a webcam or uploaded video. The backend processes video frames, maintains a 6-second (180-frame) rolling buffer for clip capture, and triggers alerts when shoplifting is detected, optionally sending email notifications with attached video clips via SMTP and SMS alerts through Twilio, with a 60-second cooldown to prevent spam. The frontend provides an intuitive dashboard featuring a live video feed, source selection (webcam or upload), and toggle buttons to enable/disable email, SMS, and clip capture functionalities, all synchronized with the backend via Socket.IO events. Additional features include a snapshot tool, a searchable alert log with pause and clear options, and audio alerts, with clip capture toggleable from the frontend to control buffer usage, ensuring efficient memory management and user-controlled evidence recording.

## Features
- **Real-Time Detection**: Uses a pre-trained LRCN model to analyze video sequences for shoplifting.
- **Video Sources**: Supports live webcam feed or uploaded video files.
- **Notifications**: Sends email with video clip attachments (if enabled) and SMS alerts with a cooldown period.
- **Clip Capture**: Records 6-second clips of incidents, toggleable from the frontend.
- **Frontend Dashboard**: Live feed, source switching, toggle controls, snapshot capability, and alert logging.
- **Efficiency**: Buffer clears when clip capture is disabled, optimizing memory usage.

## Requirements
- **Python 3.11+**: Backend runtime environment.
- **Dependencies**: Install via `pip install -r requirements.txt` (see below for sample).
- **Pre-trained Model**: `LRCN_model___Date_Time_2025_01_28__21_19_11___Loss_0.5761117339134216___Accuracy_0.739130437374115.h5`.
- **Environment Variables**: Configure in a `.env` file (see setup).

## Setup Instructions
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Joshua-Darash/Shoplifting-Action-Detection.git
   cd Shoplifting-Action-Detection
2. **Install enviroment, libraries, and node modules**:
     - **On the backend, install python enviroment and libraries**
     - **On the frontend, install npm**
4. **To test, open two PowerShell terminals**:
    - **Terminal 1**:
      ```bash
      cd backend
      python app.py

   - **Terminal 2**:
      ```bash
      cd frontend
      npm run dev
