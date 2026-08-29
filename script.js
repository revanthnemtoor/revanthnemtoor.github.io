document.addEventListener('DOMContentLoaded', () => {
    const progressBar = document.querySelector('.progress-bar');
    const statusText = document.getElementById('status-text');

    const statuses = [
        "Planting seeds...",
        "Watering the garden...",
        "Baking some pie...",
        "Listening to the birds...",
        "Watching the sunset..."
    ];

    let currentStatusIndex = 0;
    let progress = 0;

    // Simulate progress
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        
        if (progress > 95) {
            progress = 95; // Stop at 95% to simulate "almost done"
            clearInterval(progressInterval);
        }
        
        progressBar.style.width = `${progress}%`;
    }, 1000);

    // Rotate status text
    setInterval(() => {
        currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
        
        // Add a simple fade effect
        statusText.style.opacity = 0;
        setTimeout(() => {
            statusText.textContent = statuses[currentStatusIndex];
            statusText.style.opacity = 1;
        }, 300); // 300ms matches a standard CSS transition if we added it
        
    }, 3000);
});
