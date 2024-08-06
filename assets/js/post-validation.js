// Define validation functions
function validateUserId(userId) {
    return Number.isInteger(userId) && userId > 0; // Assuming userId is a positive integer
}

function validatePostId(postId) {
    return Number.isInteger(postId) && postId > 0; // Assuming postId is a positive integer
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

function validatePost(postData, returnOnFirstError = false) {
    const errors = {}
    // Title
    const title = postData.title;
    if (!validateTitle(title)) {
        errors.title = 'Title must be a non-empty string and contains at most 255 characters.';
        if (returnOnFirstError) return errors;
    }

    // Content
    const content = postData.content;
    if (!validateContent(content)) {
        errors.content = 'Content must be a non-empty string and contains at most 1023 characters.';
        if (returnOnFirstError) return errors;
    }

    return Object.keys(errors).length === 0 ? true : errors;
}

function displayPostErrors(document, errors) {
    // Display errors in your form UI
    for (const [key, value] of Object.entries(errors)) {
        const errorElement = document.getElementById(`${key}Error`);
        const inputElement = document.getElementById(key);
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
        validateUserId,
        validatePostId,
        validateTitle,
        validateContent,
        validateDate,
        validateIsVisible,
        validatePost,
        displayPostErrors
    };
}