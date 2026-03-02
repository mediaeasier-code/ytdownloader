document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusContainer = document.getElementById('statusContainer');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const logOutput = document.getElementById('logOutput');

    downloadBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            statusContainer.classList.add('visible');
            statusText.innerHTML = '<span class="text-error">Please enter a valid YouTube URL</span>';
            return;
        }

        // Reset UI
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Downloading...';

        statusContainer.classList.add('visible');
        statusText.innerHTML = `Starting downlaod... <span class="status-percentage" id="percentText">0%</span>`;
        progressBar.style.width = '0%';
        progressBar.style.background = 'linear-gradient(90deg, var(--accent-color) 0%, #ff4d4d 100%)';
        logOutput.innerText = 'Initializing...\n';

        // Start download via IPC
        window.electronAPI.downloadVideo(url);
    });

    window.electronAPI.onDownloadLog((logText) => {
        logOutput.innerText += logText;
        logOutput.scrollTop = logOutput.scrollHeight;
    });

    window.electronAPI.onDownloadProgress((data) => {
        const percent = data.percent;
        progressBar.style.width = `${percent}%`;
        const percentText = document.getElementById('percentText');
        if (percentText) {
            percentText.innerText = `${percent}%`;
        }
        statusText.innerHTML = `Downloading video... <span class="status-percentage" id="percentText">${percent}%</span>`;
    });

    window.electronAPI.onDownloadComplete((msg) => {
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, var(--success-color) 0%, #34d399 100%)';
        statusText.innerHTML = `<span class="text-success">${msg}</span>`;

        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> Download Another';
        urlInput.value = '';
    });

    window.electronAPI.onDownloadError((err) => {
        progressBar.style.width = '100%';
        progressBar.style.background = 'var(--error-color)';
        statusText.innerHTML = `<span class="text-error">Error: ${err}</span>`;

        downloadBtn.disabled = false;
        downloadBtn.innerHTML = 'Retry Download';
    });

    // Handle Enter key
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            downloadBtn.click();
        }
    });
});

// Add spin animation to document head
const style = document.createElement('style');
style.innerHTML = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);
