function validatePostId(postId) {
	return (typeof postId) ==='string' && (postId==='0'  || /^[1-9]\d*$/.test(postId))
}

function validateTitle(title) {
    return typeof title === 'string' && title.trim().length > 0 && title.length <= 255;
}

function validateContent(content) {
    return typeof content === 'string' && content.trim().length > 0 && content.length <= 1023;
}

function validateDate(date) {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
}

function validateIsVisible(isVisible) {
    return typeof isVisible === 'boolean';
}

function validatePost(postData, returnOnFirstError = false, isEdit = false) {
    const errors = {}
    // Title
	const isForm = postData instanceof FormData 
    const title = isForm?postData.get('title'):postData.title;
    if (!validateTitle(title)) {
        errors.title = 'Title must be a non-empty string and contains at most 255 characters.';
        if (returnOnFirstError) return errors;
    }

    // Content
    const content = isForm?postData.get('content'):postData.content;
    if (!validateContent(content)) {
        errors.content = 'Content must be a non-empty string and contains at most 1023 characters.';
        if (returnOnFirstError) return errors;
    }
	if (isEdit){
		const postId = isForm?postData.get('postId'):postData.postId
		if(!validatePostId(postId)){
			errors.postId = 'Invalid post'
			if (returnOnFirstError)return errors;
		}
	}
    return Object.keys(errors).length === 0 ? true : errors;
}

function displayPostErrors(document, errors, isEdit = false) {
    // Display errors in your form UI
    for (const [key, value] of Object.entries(errors)) {
        const errorElement = document.getElementById((isEdit?'edit':'')+`${key}Error`);
        const inputElement = document.getElementById(isEdit?`edit${key}`:key);
        if (errorElement) {
            errorElement.textContent = value;
        }
        if (inputElement) {
            inputElement.classList.add('is-invalid');
        }
    }
}

// Check if we are in a Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validatePostId,
        validateTitle,
        validateContent,
        validateDate,
        validateIsVisible,
        validatePost,
        displayPostErrors
    };
}
