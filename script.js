const textInput = document.getElementById('text-input');
const speakButton = document.getElementById('speak-button');
const mouth = document.getElementById('mouth');

let maleVoice = null;
const synth = window.speechSynthesis;

// Funkcja szukająca głosu męskiego
function findMaleVoice() {
    // Musimy poczekać, aż głosy zostaną załadowane
    const voices = synth.getVoices();
    
    // Szukamy polskiego głosu, który prawdopodobnie jest męski.
    // Domyślne nazwy głosu mogą się różnić (np. 'Zosia' vs 'Krzysztof').
    maleVoice = voices.find(voice => 
        voice.lang.includes('pl') && 
        !voice.name.toLowerCase().includes('female') && 
        !voice.name.toLowerCase().includes('kobieta') &&
        !voice.name.toLowerCase().includes('zosia')
    ) || voices.find(voice => voice.lang.includes('pl')); // Awaryjnie bierzemy jakikolwiek polski głos
}

// Głosy są ładowane asynchronicznie, więc nasłuchujemy na zdarzenie 'onvoiceschanged'
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = findMaleVoice;
} else {
    // W niektórych przeglądarkach wywołujemy funkcję bezpośrednio
    findMaleVoice();
}


// Główna funkcja odczytywania tekstu
function speakText() {
    const textToSpeak = textInput.value.trim();
    if (textToSpeak === '' || synth.speaking) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Ustawienie głosu (znalezionego lub domyślnego)
    if (maleVoice) {
        utterance.voice = maleVoice;
    } else {
        utterance.lang = 'pl-PL'; 
    }
    
    // --- Kontrola Animacji ---
    
    // Rozpoczęcie animacji przy starcie mowy
    utterance.onstart = () => {
        mouth.style.animationPlayState = 'running';
        speakButton.disabled = true;
        speakButton.textContent = 'Mówię...';
    };

    // Zatrzymanie animacji po zakończeniu mowy
    utterance.onend = () => {
        mouth.style.animationPlayState = 'paused';
        speakButton.disabled = false;
        speakButton.textContent = 'Odczytaj Głos Męski';
    };
    
    // W przypadku błędu (np. głos niedostępny)
    utterance.onerror = (event) => {
        console.error('Błąd syntezy mowy:', event);
        mouth.style.animationPlayState = 'paused';
        speakButton.disabled = false;
        speakButton.textContent = 'Błąd, spróbuj ponownie.';
    };

    // Włącz mowę
    synth.speak(utterance);
}

// Nasłuch na kliknięcie przycisku
speakButton.addEventListener('click', speakText);

// Upewnienie się, że API jest dostępne
if (!('speechSynthesis' in window)) {
    speakButton.textContent = 'Brak wsparcia dla Web Speech API.';
    speakButton.disabled = true;
}