const crypto = require('crypto');

// 1. Create a dummy "image" buffer (just text for testing)
const dummyImageBuffer = Buffer.from('Testing the image upload endpoint 123', 'utf8');

// 2. Calculate the SHA-256 hash precisely like the ESP32 does
const calculatedHash = crypto.createHash('sha256').update(dummyImageBuffer).digest('hex');

console.log('Sending Dummy Image...');
console.log('Generated Hash:  ', calculatedHash);

// 3. Send the POST request to the local Next.js API
fetch('http://localhost:3000/api/upload-image', {
    method: 'POST',
    headers: {
        'Content-Type': 'image/jpeg',
        'X-Image-Hash': calculatedHash
    },
    body: dummyImageBuffer
})
    .then(res => res.json())
    .then(data => {
        console.log('\n--- Server Response ---');
        console.log(data);
    })
    .catch(err => {
        console.error('\n--- Request Failed ---', err.message);
        console.log('Make sure your Next.js server is running on localhost:3000');
    });
