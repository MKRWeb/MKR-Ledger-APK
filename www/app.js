class MkrLedger {
    constructor() {
        this.items = [];
        this.initDate();
        this.loadData();
        this.bindEvents();
    }

    initDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
        document.getElementById('receipt-date').innerText = new Date().toLocaleDateString('en-US', options);

        const dateInput = document.getElementById('receipt-label');
        const savedDate = localStorage.getItem('mkr_bazar_date');
        if (savedDate) {
            dateInput.value = savedDate;
        } else {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        dateInput.addEventListener('change', (e) => {
            localStorage.setItem('mkr_bazar_date', e.target.value);
        });
    }

    bindEvents() {
        const priceInput = document.getElementById('item-price');
        const nameInput = document.getElementById('item-name');

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                priceInput.focus();
            }
        });

        priceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addItem();
            }
        });
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    saveData() {
        localStorage.setItem('mkr_bazar_list', JSON.stringify(this.items));
    }

    loadData() {
        const saved = localStorage.getItem('mkr_bazar_list');
        if (saved) {
            try {
                this.items = JSON.parse(saved);
            } catch (e) {
                this.items = [];
            }
        }
        this.renderList();
    }

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    addItem() {
        const nameInput = document.getElementById('item-name');
        const priceInput = document.getElementById('item-price');
        
        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value);

        if (name && !isNaN(price) && price >= 0) {
            const newItem = { id: Date.now(), name: name, price: price };
            this.items.push(newItem);
            this.saveData();
            this.renderList();
            
            nameInput.value = '';
            priceInput.value = '';
            nameInput.focus();
        } else {
            this.showToast("⚠️ Enter a valid item name and price");
        }
    }

    deleteItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveData();
        this.renderList();
    }

    clearList() {
        if (this.items.length === 0) return;
        if (confirm("Are you sure you want to clear the entire list?")) {
            this.items = [];
            this.saveData();
            this.renderList();
            this.showToast("🗑️ List cleared");
        }
    }

    renderList() {
        const listEl = document.getElementById('item-list');
        listEl.innerHTML = '';
        let total = 0;

        this.items.forEach(item => {
            total += item.price;
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="item-info">${this.escapeHTML(item.name)}</div>
                <div class="item-price">${item.price.toFixed(2)}</div>
                <button class="delete-btn" onclick="mkr.deleteItem(${item.id})" title="Remove item" data-html2canvas-ignore>✖</button>
            `;
            listEl.appendChild(li);
        });

        document.getElementById('grand-total').innerText = total.toFixed(2);
    }

    async generateCanvasDataUrl() {
        const captureArea = document.getElementById('capture-area');
        const canvas = await html2canvas(captureArea, {
            scale: 2,
            backgroundColor: '#fffdf8',
            useCORS: true
        });
        return canvas.toDataURL('image/jpeg', 0.95);
    }

    async downloadJPG() {
        if (this.items.length === 0) {
            this.showToast("⚠️ List is empty!");
            return;
        }

        const btn = document.getElementById('save-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Saving...";

        try {
            const dataUrl = await this.generateCanvasDataUrl();
            const base64Data = dataUrl.split(',')[1];
            const fileName = `MKR_Ledger_${Date.now()}.jpg`;

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const { Filesystem } = window.Capacitor.Plugins;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: 'DOCUMENTS'
                });
                this.showToast(`✅ Saved to Documents/${fileName}`);
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showToast("✅ Image downloaded!");
            }
        } catch (err) {
            console.error("Save error:", err);
            this.showToast("❌ Failed to save image");
        } finally {
            btn.innerHTML = originalText;
        }
    }

    async shareList() {
        if (this.items.length === 0) {
            this.showToast("⚠️ List is empty!");
            return;
        }

        const shareBtn = document.getElementById('share-btn');
        const originalText = shareBtn.innerHTML;
        shareBtn.innerHTML = "⏳ Preparing...";

        try {
            const dataUrl = await this.generateCanvasDataUrl();
            const base64Data = dataUrl.split(',')[1];
            const fileName = `MKR_Ledger_${Date.now()}.jpg`;

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const { Filesystem, Share } = window.Capacitor.Plugins;
                
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: 'CACHE'
                });

                await Share.share({
                    title: 'MKR Ledger Receipt',
                    text: 'Here is my MKR Ledger calculation.',
                    url: savedFile.uri,
                    dialogTitle: 'Share Bazar Receipt'
                });
            } else {
                this.showFallbackModal(dataUrl);
            }
        } catch (err) {
            console.log("Share cancelled or failed:", err);
        } finally {
            shareBtn.innerHTML = originalText;
        }
    }

    showFallbackModal(dataUrl) {
        const modal = document.getElementById('image-modal');
        const previewImage = document.getElementById('preview-image');
        previewImage.src = dataUrl;
        modal.style.display = 'block';
    }

    closeModal() {
        document.getElementById('image-modal').style.display = 'none';
    }
}

window.onload = () => {
    window.mkr = new MkrLedger();
};
