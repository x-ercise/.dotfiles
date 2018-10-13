const crypto = require('crypto');
const fs = require('fs');
function createHash(filename) {
    return new Promise((resolve) => {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(filename);
        input.on('error', (err) => {
            if (err.code === 'ENOENT') {
                resolve(null);
            }
            else {
                throw new Error(err);
            }
        });
        input.on('readable', () => {
            const data = input.read();
            if (data) {
                hash.update(data);
            }
            else {
                resolve(hash.digest('hex'));
            }
        });
    });
}
module.exports = { createHash };

//# sourceMappingURL=createHash.js.map
