// --- ELEMENTY INTERFEJSU ---
const textInput = document.getElementById('text-input');
const speakButton = document.getElementById('speak-button');
const mouth = document.getElementById('mouth');

const topicInput = document.getElementById('topic-input');
const autoButton = document.getElementById('auto-button');
const stopButton = document.getElementById('stop-button');
const statusInfo = document.getElementById('status-info');

// --- ZMIENNE GLOBALNE ---
let maleVoice = null;
let autoInterval = null;
let sentences = [];
let currentSentenceIndex = 0;
const synth = window.speechSynthesis;

// --- LOGIKA GŁOSU ---
function loadVoices() {
    const voices = synth.getVoices();
    // Szukamy polskiego głosu męskiego (np. Marek, Krzysztof, Paul)
    maleVoice = voices.find(v => v.lang.includes('pl') && (v.name.includes('Marek') || v.name.includes('Krzysztof') || v.name.includes('Paul'))) 
                || voices.find(v => v.lang.includes('pl'));
}

if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
}

// --- GŁÓWNA FUNKCJA MÓWIENIA ---
function speakText(text, callback = null) {
    if (synth.speaking) return;

    const utterance = new SpeechSynthesisUtterance(text);
    if (maleVoice) utterance.voice = maleVoice;
    utterance.lang = 'pl-PL';

    utterance.onstart = () => {
        mouth.style.animationPlayState = 'running';
        speakButton.disabled = true;
    };

    utterance.onend = () => {
        mouth.style.animationPlayState = 'paused';
        speakButton.disabled = false;
        if (callback) callback(); // Wywołaj następne kroki po skończeniu mówienia
    };

    synth.speak(utterance);
}

// --- LOGIKA TRYBU AUTOMATYCZNEGO (WIKIPEDIA) ---
async function fetchWikiData() {
    const topic = topicInput.value.trim();
    if (!topic) {
        alert("Wpisz temat!");
        return;
    }

    statusInfo.textContent = "🔍 Szukam informacji w Wikipedii...";
    
    try {
        // Pobieramy podsumowanie strony z Wikipedii
        const response = await fetch(`https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
        const data = await response.json();

        if (data.extract) {
            // Dzielimy tekst na zdania
            sentences = data.extract.split('. ').filter(s => s.length > 10);
            currentSentenceIndex = 0;
            startAutoLoop();
        } else {
            statusInfo.textContent = "❌ Nie znaleziono tematu.";
        }
    } catch (error) {
        statusInfo.textContent = "❌ Błąd połączenia.";
    }
}

function startAutoLoop() {
    autoButton.style.display = 'none';
    stopButton.style.display = 'inline-block';
    
    runStep(); // Uruchom pierwszy raz od razu
}

function runStep() {
    if (currentSentenceIndex < sentences.length) {
        const textToSay = sentences[currentSentenceIndex];
        textInput.value = textToSay; // Pokazujemy tekst w okienku
        
        statusInfo.textContent = `🗣️ Mówię zdanie ${currentSentenceIndex + 1} z ${sentences.length}...`;
        
        speakText(textToSay, () => {
            currentSentenceIndex++;
            if (currentSentenceIndex < sentences.length) {
                statusInfo.textContent = "⏳ Przerwa 30 sekund...";
                autoInterval = setTimeout(runStep, 30000); // CZEKAJ 30 SEKUND
            } else {
                stopAutoMode("Koniec informacji.");
            }
        });
    }
}

function stopAutoMode(msg = "Zatrzymano.") {
    clearTimeout(autoInterval);
    synth.cancel(); // Przestań mówić natychmiast
    mouth.style.animationPlayState = 'paused';
    autoButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    statusInfo.textContent = msg;
}

// --- EVENT LISTENERY ---
speakButton.addEventListener('click', () => speakText(textInput.value));
autoButton.addEventListener('click', fetchWikiData);
stopButton.addEventListener('click', () => stopAutoMode());