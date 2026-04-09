double-check current IPv4 address (using ipconfig in the Windows terminal) and update the serverURL at the top of both nammudesensor.ino and nammudecamera.ino if on a different WiFi network now.

WORKING:
1. The Trigger: Whenever hardware setup applies a HIGH signal (3.3V) to Pin 14 on the ESP32 Camera board, it registers as a trigger.
2. The Capture: The ESP32 immediately takes a picture and holds it in memory.
3. The Processing: It mathematically hashes the raw image bytes into a SHA-256 string.
4. The Automatic Upload: It opens an HTTP POST request to http://10.204.146.11:3000/api/upload-image, attaches the hash as a header, and sends the raw image data.
5. The Cooldown: It waits for 5 seconds (delay(5000);) before it allows another picture to be taken, preventing the server from being flooded if the button/sensor is held down.