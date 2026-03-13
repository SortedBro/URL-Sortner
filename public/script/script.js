function copyUrl() {
    const url = document.getElementById("shortUrl").innerText

    navigator.clipboard.writeText(url)

    alert("Copied!")
}