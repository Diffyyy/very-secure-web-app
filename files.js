const fs = require('fs');
function deleteFile(path){
	fs.unlinkSync(path)	
}
async function validateImage(path){
	try{
		const fileType = await import('file-type');
		const fileBuffer = fs.readFileSync(path);
		const fileTypeResult = await fileType.fileTypeFromBuffer(fileBuffer);

		if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
			deleteFile(path); // Delete the invalid file
			return false
		}
	}catch(err){
		console.log(err)
		return false
	}
	return true
}
module.exports = {deleteFile, validateImage}
