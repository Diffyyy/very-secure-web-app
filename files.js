const fs = require('fs');
const sharp = require('sharp');
const {handleError} = require('./error-handler')
function deleteFile(path){
	fs.unlinkSync(path)	
}
async function validateImage(path){
	try{
		const fileType = await import('file-type');
		const fileBuffer = fs.readFileSync(path);
		const fileTypeResult = await fileType.fileTypeFromBuffer(fileBuffer);
		//check magic number
		if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
			deleteFile(path); // Delete the invalid file
			return new Error('Image has invalid image header')	
		}
		//try to resize image
		try{
			const resized = await sharp(fileBuffer).resize(100).toBuffer()
		}catch(err){
			deleteFile(path)
			return err
		}
	}catch(err){
		return err
	}
	return true
}
module.exports = {deleteFile, validateImage}
