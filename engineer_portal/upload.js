// Function to handle file selection for each certificate type
function triggerFile(inputId) {
    document.getElementById(inputId).click();
}

// Monitor file selection to show feedback (optional)
['invoice', 'icdc', 'bill'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
        input.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                alert(id.toUpperCase() + " selected: " + this.files[0].name);
            }
        });
    }
});

// Final Submit Function for the Engineer Portal
async function submitJob() {
    const formData = new FormData();
    
    // UI inputs-ah edukurom
    const invoiceFile = document.getElementById('invoice').files[0];
    const icdcFile = document.getElementById('icdc').files[0];
    const billFile = document.getElementById('bill').files[0];

    if (!invoiceFile && !icdcFile && !billFile) {
        alert("Please select at least one certificate.");
        return;
    }

    if (invoiceFile) formData.append('invoice', invoiceFile);
    if (icdcFile) formData.append('icdc', icdcFile);
    if (billFile) formData.append('bill', billFile);
    
    // Engineer ID-ah local storage-la irundhu edukurom
    formData.append('engineer_id', localStorage.getItem('engineer_id'));

    try {
        // Idhu dhaan mukkiyama 'Replace' panna vendiya fetch code
        const response = await fetch('http://localhost:3000/api/upload-certificates', {
            method: 'POST',
            body: formData 
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert("Success: " + result.message);
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Server connect aagala! Check if 'node server.js' is running.");
    }
}