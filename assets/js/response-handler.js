
//400 - Invalid Input
//408 - Session timeout
//419 - Invalid CSRF token
function handleResponse(response){
	if (response.status===403){
		alert("User has been banned")
		window.location.replace("/")
		return true
	}
	if (response.status===408){
		alert("Session timeout, redirecting to home")	
		window.location.replace("/")
		return true
	}
	if(response.status===419){
		alert("Invalid token, please try again")
		return true
	}
	return false
}
