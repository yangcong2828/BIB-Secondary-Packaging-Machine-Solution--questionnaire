let currentStep = 1;
const totalSteps = 3;
const STORAGE_KEY = 'vbib_questionnaire_draft';
const SUBMISSIONS_KEY = 'vbib_submissions';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadDraft();
  updateUI();
  syncMobileDesktopInputs();
});

// Sync mobile <-> desktop duplicate inputs (for table/card views)
function syncMobileDesktopInputs() {
  const pairs = [
    // Primary bags
    ['pb1_weight', 'pb1_weight_m'], ['pb1_film', 'pb1_film_m'], ['pb1_notes', 'pb1_notes_m'],
    ['pb2_weight', 'pb2_weight_m'], ['pb2_film', 'pb2_film_m'], ['pb2_notes', 'pb2_notes_m'],
    ['pb3_weight', 'pb3_weight_m'], ['pb3_film', 'pb3_film_m'], ['pb3_notes', 'pb3_notes_m'],
    // Master bags
    ['mb1_combination', 'mb1_combination_m'], ['mb1_size', 'mb1_size_m'], ['mb1_notes', 'mb1_notes_m'],
    ['mb2_combination', 'mb2_combination_m'], ['mb2_size', 'mb2_size_m'], ['mb2_notes', 'mb2_notes_m'],
    ['mb3_combination', 'mb3_combination_m'], ['mb3_size', 'mb3_size_m'], ['mb3_notes', 'mb3_notes_m'],
  ];

  pairs.forEach(([desktopId, mobileId]) => {
    const desktop = document.getElementById(desktopId);
    const mobile = document.getElementById(mobileId);
    if (!desktop || !mobile) return;

    desktop.addEventListener('input', () => { mobile.value = desktop.value; });
    mobile.addEventListener('input', () => { desktop.value = mobile.value; });
  });
}

// Collect all form data
function collectData() {
  return {
    // Part 1: Product Properties
    productProperties: {
      productDescription: document.getElementById('productDescription').value,
      particleSize: document.getElementById('particleSize').value,
      density: document.getElementById('density').value,
      waterContent: document.getElementById('waterContent').value,
      corrosiveness: getRadioValue('corrosiveness')
    },
    // Part 2: Packaging Specifications
    packagingSpecs: {
      primaryBags: [
        { bag: 'Bag-1', weight: valSync('pb1_weight'), film: valSync('pb1_film'), notes: valSync('pb1_notes') },
        { bag: 'Bag-2', weight: valSync('pb2_weight'), film: valSync('pb2_film'), notes: valSync('pb2_notes') },
        { bag: 'Bag-3', weight: valSync('pb3_weight'), film: valSync('pb3_film'), notes: valSync('pb3_notes') }
      ],
      masterBags: [
        { bag: 'Bag-1', combination: valSync('mb1_combination'), size: valSync('mb1_size'), notes: valSync('mb1_notes') },
        { bag: 'Bag-2', combination: valSync('mb2_combination'), size: valSync('mb2_size'), notes: valSync('mb2_notes') },
        { bag: 'Bag-3', combination: valSync('mb3_combination'), size: valSync('mb3_size'), notes: valSync('mb3_notes') }
      ]
    },
    // Part 3: Production & Process Parameters
    processParameters: {
      packagingProcess: val('packagingProcess'),
      solutionDescription: val('solutionDescription'),
      primarySpeed: val('primarySpeed'),
      weighingAccuracy: val('weighingAccuracy'),
      secondarySpeed: val('secondarySpeed'),
      countingAccuracy: val('countingAccuracy'),
      sealingType: getRadioValue('sealingType'),
      stackingPattern: getRadioValue('stackingPattern'),
      machineMaterial: getRadioValue('machineMaterial'),
      palletizing: val('palletizing')
    }
  };
}

// Get value, preferring desktop but falling back to mobile
function valSync(id) {
  const desktop = document.getElementById(id);
  const mobile = document.getElementById(id + '_m');
  const dVal = desktop ? desktop.value : '';
  const mVal = mobile ? mobile.value : '';
  return dVal || mVal;
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function getRadioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

// Restore form data
function restoreData(data) {
  if (!data) return;

  // Part 1
  if (data.productProperties) {
    const p = data.productProperties;
    setVal('productDescription', p.productDescription);
    setVal('particleSize', p.particleSize);
    setVal('density', p.density);
    setVal('waterContent', p.waterContent);
    setRadio('corrosiveness', p.corrosiveness);
  }

  // Part 2
  if (data.packagingSpecs) {
    const s = data.packagingSpecs;
    if (s.primaryBags) {
      s.primaryBags.forEach((b, i) => {
        const n = i + 1;
        setVal(`pb${n}_weight`, b.weight);
        setVal(`pb${n}_film`, b.film);
        setVal(`pb${n}_notes`, b.notes);
        // Also set mobile inputs
        setVal(`pb${n}_weight_m`, b.weight);
        setVal(`pb${n}_film_m`, b.film);
        setVal(`pb${n}_notes_m`, b.notes);
      });
    }
    if (s.masterBags) {
      s.masterBags.forEach((b, i) => {
        const n = i + 1;
        setVal(`mb${n}_combination`, b.combination);
        setVal(`mb${n}_size`, b.size);
        setVal(`mb${n}_notes`, b.notes);
        setVal(`mb${n}_combination_m`, b.combination);
        setVal(`mb${n}_size_m`, b.size);
        setVal(`mb${n}_notes_m`, b.notes);
      });
    }
  }

  // Part 3
  if (data.processParameters) {
    const pp = data.processParameters;
    setVal('packagingProcess', pp.packagingProcess);
    setVal('solutionDescription', pp.solutionDescription);
    setVal('primarySpeed', pp.primarySpeed);
    setVal('weighingAccuracy', pp.weighingAccuracy);
    setVal('secondarySpeed', pp.secondarySpeed);
    setVal('countingAccuracy', pp.countingAccuracy);
    setRadio('sealingType', pp.sealingType);
    setRadio('stackingPattern', pp.stackingPattern);
    setRadio('machineMaterial', pp.machineMaterial);
    setVal('palletizing', pp.palletizing);
  }
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

function setRadio(name, value) {
  if (!value) return;
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

// Save draft to LocalStorage
function saveDraft() {
  const data = collectData();
  data._currentStep = currentStep;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Load draft from LocalStorage
function loadDraft() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    currentStep = data._currentStep || 1;
    restoreData(data);
  } catch (e) {
    // ignore
  }
}

// Auto-save on input change
document.addEventListener('input', saveDraft);
document.addEventListener('change', saveDraft);

// Validate current step
function validateStep(step) {
  const section = document.getElementById(`step-${step}`);
  const required = section.querySelectorAll('[required]');
  let valid = true;

  required.forEach(el => {
    if (el.type === 'radio') {
      const name = el.name;
      if (!getRadioValue(name)) valid = false;
    } else if (!el.value.trim()) {
      valid = false;
    }
  });

  if (!valid) {
    // Highlight empty required fields
    required.forEach(el => {
      if (el.type === 'radio') {
        const group = el.closest('.radio-group');
        if (!getRadioValue(el.name)) {
          group.style.outline = '2px solid #dc2626';
          group.style.borderRadius = '8px';
          setTimeout(() => { group.style.outline = ''; }, 3000);
        }
      } else if (!el.value.trim()) {
        el.style.borderColor = '#dc2626';
        setTimeout(() => { el.style.borderColor = ''; }, 3000);
      }
    });
  }

  return valid;
}

// Navigation
function nextStep() {
  if (!validateStep(currentStep)) return;
  if (currentStep < totalSteps) {
    currentStep++;
    saveDraft();
    updateUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    saveDraft();
    updateUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Update UI based on current step
function updateUI() {
  // Update sections
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  const activeSection = document.getElementById(`step-${currentStep}`);
  if (activeSection) activeSection.classList.add('active');

  // Update progress bar
  document.querySelectorAll('.progress-step').forEach(s => {
    const step = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (step === currentStep) s.classList.add('active');
    else if (step < currentStep) s.classList.add('completed');
  });

  // Update buttons
  document.getElementById('btn-prev').disabled = currentStep === 1;
  document.getElementById('btn-next').style.display = currentStep < totalSteps ? '' : 'none';
  document.getElementById('btn-submit').style.display = currentStep === totalSteps ? '' : 'none';
}

// Submit form
function submitForm() {
  if (!validateStep(currentStep)) return;

  const data = collectData();
  data.submittedAt = new Date().toISOString();
  data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Save to submissions list
  const submissions = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]');
  submissions.push(data);
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));

  // Clear draft
  localStorage.removeItem(STORAGE_KEY);

  // Show success page
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.getElementById('success-page').classList.add('active');
  document.getElementById('form-actions').style.display = 'none';

  // Mark all steps as completed
  document.querySelectorAll('.progress-step').forEach(s => s.classList.add('completed'));
  document.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active'));

  // Store last submission for download
  window._lastSubmission = data;
}

// Download JSON
function downloadJSON() {
  const data = window._lastSubmission;
  if (!data) return;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BIB_Questionnaire_${data.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
