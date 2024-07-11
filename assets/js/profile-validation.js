// validation.js

// Define validation functions
function validateName(name) {
    return /^[A-Za-z]{1,20}$/.test(name);
}

function validateEmail(email) {
    return /^[a-zA-Z\d]+([._-][a-zA-Z\d]+)*@[-a-zA-Z\d]+(\.[-a-zA-Z\d]+)*\.[a-zA-Z]{2,}$/.test(email);
}

function validateMobileNumber(number) {
    return /^(\+63|0)\d{10}$/.test(number);
}

function validateAge(age) {
	const parsed = parseInt(age, 10)
    return !isNaN(parsed) && parsed > 0 && parsed <=200;
}

function validatePassword(password) {
    return /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_=+{};:,<.>\\?-]).{12,63}$/.test(password);
}

function validateForm(formData, isSignup, returnOnFirstError = false) {
    const errors = {};

    // Profile Picture (optional for update)
	
	const isForm = formData instanceof FormData 
    if (isSignup) {
        const profilepic = isForm?formData.get('profilepic'):formData.profilepic
        if (!profilepic) {
            errors.profilepic = 'Profile picture is required.';
            if (returnOnFirstError) return errors;
        }
    }

    // Last Name
    const lastname = isForm?formData.get('lastname'):formData.lastname;
    if (!validateName(lastname)) {
        errors.lastname = 'Last name must be up to 20 English letters.';
        if (returnOnFirstError) return errors;
    }

    // First Name
    const firstname = isForm?formData.get('firstname'):formData.firstname;
    if (!validateName(firstname)) {
        errors.firstname = 'First name must be up to 20 English letters.';
        if (returnOnFirstError) return errors;
    }

    // Email
    if (isSignup) {
        const email = isForm?formData.get('email'):formData.email
        if (!validateEmail(email)) {
            errors.email = 'Email format is invalid.';
            if (returnOnFirstError) return errors;
        }
    }

    // Mobile Number
    const number = isForm?formData.get('number'):formData.number
    if (!validateMobileNumber(number)) {
        errors.number = 'Mobile number format is invalid.';
        if (returnOnFirstError) return errors;
    }

    // Age
    const age = isForm?formData.get('age'):formData.age
    if (!validateAge(age)) {
        errors.age = 'Age should be whole number from 1 to 200';
        if (returnOnFirstError) return errors;
    }

    // Password (for signup)
    if (isSignup) {
        const password = isForm?formData.get('password'):formData.password
        if (!validatePassword(password)) {
            errors.password = 'Password must be 12-63 characters long and include at least one number, one uppercase letter, one lowercase letter, and one special character (@._-!?).';
            if (returnOnFirstError) return errors;
        }

        // Confirm Password (for signup)
        const confirmpassword = isForm?formData.get('confirmpassword'):formData.confirmpassword
        if (password !== confirmpassword) {
            errors.confirmpassword = 'Passwords do not match.';
            if (returnOnFirstError) return errors;
        }
    }

    return Object.keys(errors).length === 0 ? true : errors;
}

function displayFormErrors(document, errors) {
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
        validateName,
        validateEmail,
        validateMobileNumber,
        validateAge,
        validatePassword,
        validateForm,
        displayFormErrors
    };
}
