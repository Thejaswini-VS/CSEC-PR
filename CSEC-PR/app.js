// ==========================================================================
// PR Contributor Wall Physics & Simulation Engine (DOM Parsing Edition)
// ==========================================================================

const config = {
  gravityStrength: 0.005,    // Gentle center pull
  repulsionStrength: 65,     // Push force between bubbles
  damping: 0.72,             // Velocity friction (stops swirling quickly)
  collisionPadding: 12,      // Separation distance
  baseNodeRadius: 44,        // Minimum bubble size
  maxNodeRadius: 66          // Maximum bubble size
};

const state = {
  nodes: [],                 // Active physics representation array
  prCounter: 1024,           // Base PR sequential index
  dragNode: null,            // Currently dragged node
  dragOffset: { x: 0, y: 0 },
  width: 0,
  height: 0,
  center: { x: 0, y: 0 }
};

const elements = {
  visualSpace: document.getElementById('visualization-space'),
  bubbleContainer: document.getElementById('bubble-container'),
  prNotificationPanel: document.getElementById('pr-notification-panel'),
  counterBadge: document.getElementById('contributions-count'),
  
  modal: document.getElementById('modal-overlay'),
  modalName: document.getElementById('modal-name'),
  modalDesc: document.getElementById('modal-desc'),
  modalHash: document.getElementById('modal-hash'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnDoneModal: document.getElementById('btn-done')
};

// --------------------------------------------------
// Node Physics representation class
// --------------------------------------------------
class PhysicsNode {
  constructor(domElement, initiallyHidden = false) {
    this.domElement = domElement;
    this.name = domElement.querySelector('.bubble-name').innerText;
    this.description = domElement.querySelector('.bubble-desc').innerText;
    this.commitHash = Math.random().toString(16).substring(2, 9);
    
    // Assign sizes randomly between baseline configs
    this.radius = config.baseNodeRadius + Math.random() * (config.maxNodeRadius - config.baseNodeRadius);
    this.mass = this.radius * 0.15;
    
    // Position setup: distribute initially in ring, or spawn at center
    const angle = Math.random() * Math.PI * 2;
    const ringRadius = Math.min(state.width, state.height) * 0.25;
    
    this.x = state.center.x + Math.cos(angle) * ringRadius + (Math.random() - 0.5) * 40;
    this.y = state.center.y + Math.sin(angle) * ringRadius + (Math.random() - 0.5) * 40;
    
    this.vx = 0;
    this.vy = 0;
    
    // Assign structural style attributes to element
    this.domElement.style.width = `${this.radius * 2}px`;
    this.domElement.style.height = `${this.radius * 2}px`;
    this.domElement.style.setProperty('--tx', `${this.x - this.radius}px`);
    this.domElement.style.setProperty('--ty', `${this.y - this.radius}px`);
    
    if (initiallyHidden) {
      this.domElement.style.display = 'none';
      this.domElement.style.opacity = '0';
    } else {
      this.domElement.style.display = 'flex';
      this.domElement.style.opacity = '1';
    }

    this.bindEvents();
  }

  bindEvents() {
    // Open metadata modal on click (if not dragged)
    this.domElement.addEventListener('click', () => {
      if (this.wasDragged) {
        this.wasDragged = false;
        return;
      }
      openModal(this);
    });

    // Mousedown sets node state to drag mode
    this.domElement.addEventListener('mousedown', (e) => {
      e.preventDefault();
      state.dragNode = this;
      this.wasDragged = false;
      state.dragOffset.x = e.clientX - this.x;
      state.dragOffset.y = e.clientY - this.y;
    });
  }

  syncPosition() {
    this.domElement.style.setProperty('--tx', `${this.x - this.radius}px`);
    this.domElement.style.setProperty('--ty', `${this.y - this.radius}px`);
    this.domElement.style.transform = `translate3d(var(--tx), var(--ty), 0)`;
  }
}

// --------------------------------------------------
// Physics Math Integrations (Centering Attraction, Repulsion, Collisions)
// --------------------------------------------------
function updatePhysics() {
  const nodeCount = state.nodes.length;
  
  // 1. Particle-to-Particle Repulsion Forces
  for (let i = 0; i < nodeCount; i++) {
    const nodeA = state.nodes[i];
    if (nodeA === state.dragNode) continue;

    for (let j = i + 1; j < nodeCount; j++) {
      const nodeB = state.nodes[j];
      
      let dx = nodeB.x - nodeA.x;
      let dy = nodeB.y - nodeA.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const minDistance = nodeA.radius + nodeB.radius + config.collisionPadding;
      
      if (dist < minDistance * 2.2) {
        const forceMultiplier = (minDistance * 2.2 - dist) / dist;
        const force = forceMultiplier * config.repulsionStrength * 0.06;
        
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        if (nodeB !== state.dragNode) {
          nodeB.vx += fx / nodeB.mass;
          nodeB.vy += fy / nodeB.mass;
        }
        nodeA.vx -= fx / nodeA.mass;
        nodeA.vy -= fy / nodeA.mass;
      }
    }
  }

  // 2. Centering Attraction Gravity & Friction Damping
  for (let i = 0; i < nodeCount; i++) {
    const node = state.nodes[i];
    if (node === state.dragNode) continue;

    let gx = (state.center.x - node.x) * config.gravityStrength;
    let gy = (state.center.y - node.y) * config.gravityStrength;
    
    node.vx = (node.vx + gx) * config.damping;
    node.vy = (node.vy + gy) * config.damping;
    
    // Zero out movement below threshold to stabilize layout quickly
    if (Math.abs(node.vx) < 0.01) node.vx = 0;
    if (Math.abs(node.vy) < 0.01) node.vy = 0;

    node.x += node.vx;
    node.y += node.vy;
  }

  // 3. Collision Resolution (Overlap containment)
  for (let relaxSteps = 0; relaxSteps < 3; relaxSteps++) {
    for (let i = 0; i < nodeCount; i++) {
      const nodeA = state.nodes[i];
      
      // Boundary borders checks
      if (nodeA !== state.dragNode) {
        if (nodeA.x < nodeA.radius) {
          nodeA.x = nodeA.radius;
          nodeA.vx *= -0.1;
        }
        if (nodeA.x > state.width - nodeA.radius) {
          nodeA.x = state.width - nodeA.radius;
          nodeA.vx *= -0.1;
        }
        if (nodeA.y < nodeA.radius) {
          nodeA.y = nodeA.radius;
          nodeA.vy *= -0.1;
        }
        if (nodeA.y > state.height - nodeA.radius) {
          nodeA.y = state.height - nodeA.radius;
          nodeA.vy *= -0.1;
        }
      }

      // Check overlap separations
      for (let j = i + 1; j < nodeCount; j++) {
        const nodeB = state.nodes[j];
        let dx = nodeB.x - nodeA.x;
        let dy = nodeB.y - nodeA.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const overlapLimit = nodeA.radius + nodeB.radius + config.collisionPadding;
        
        if (dist < overlapLimit) {
          const overlap = overlapLimit - dist;
          const pushX = (dx / dist) * overlap * 0.5;
          const pushY = (dy / dist) * overlap * 0.5;
          
          if (nodeA === state.dragNode) {
            nodeB.x += pushX * 2.0;
            nodeB.y += pushY * 2.0;
          } else if (nodeB === state.dragNode) {
            nodeA.x -= pushX * 2.0;
            nodeA.y -= pushY * 2.0;
          } else {
            nodeA.x -= pushX;
            nodeA.y -= pushY;
            nodeB.x += pushX;
            nodeB.y += pushY;
          }
        }
      }
    }
  }

  // Draw current position values
  for (let i = 0; i < nodeCount; i++) {
    state.nodes[i].syncPosition();
  }
}

// Global animation loop ticker
function animationFrameTick() {
  updatePhysics();
  requestAnimationFrame(animationFrameTick);
}

// --------------------------------------------------
// Drag event handles
// --------------------------------------------------
function setupDragListeners() {
  window.addEventListener('mousemove', (e) => {
    if (!state.dragNode) return;
    
    const rect = elements.visualSpace.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - state.dragOffset.x;
    const mouseY = e.clientY - rect.top - state.dragOffset.y;
    
    state.dragNode.x = Math.max(state.dragNode.radius, Math.min(state.width - state.dragNode.radius, mouseX));
    state.dragNode.y = Math.max(state.dragNode.radius, Math.min(state.height - state.dragNode.radius, mouseY));
    state.dragNode.vx = 0;
    state.dragNode.vy = 0;
    state.dragNode.wasDragged = true;
  });

  window.addEventListener('mouseup', () => {
    if (state.dragNode) {
      state.dragNode = null;
    }
  });
}

function handleResize() {
  const rect = elements.visualSpace.getBoundingClientRect();
  state.width = rect.width;
  state.height = rect.height;
  state.center.x = state.width / 2;
  state.center.y = state.height / 2;
}

// --------------------------------------------------
// Pull Request Simulation (Integrate last bubble)
// --------------------------------------------------
function simulatePRMerge(latestNode) {
  const prNum = ++state.prCounter;
  
  // Create simulated branch opened alerts
  const toast = document.createElement('div');
  toast.className = 'pr-toast';
  toast.innerHTML = `
    <div class="pr-toast-header">
      <span class="pr-number">PR #${prNum}</span>
      <span class="pr-badge open" id="toast-badge-${prNum}">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm3 0a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM8 4a.75.75 0 100-1.5.75.75 0 000 1.5zm3.25-.75a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM13 8a.75.75 0 100-1.5.75.75 0 000 1.5zm1.5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM8 13.5a.75.75 0 100-1.5.75.75 0 000 1.5zm-3.25-.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM3 8a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
        </svg>
        PR Opened
      </span>
    </div>
    <div class="pr-toast-body">
      <span class="pr-contributor-name">${latestNode.name}</span> proposed changes: <span style="color: var(--color-text-muted)">"${latestNode.description}"</span>
    </div>
    <div class="pr-loader">
      <div class="pr-loader-bar" id="toast-progress-${prNum}"></div>
    </div>
  `;

  elements.prNotificationPanel.appendChild(toast);
  
  // Slide toast in
  setTimeout(() => {
    toast.classList.add('active');
    setTimeout(() => {
      const progress = document.getElementById(`toast-progress-${prNum}`);
      if (progress) progress.style.width = '100%';
    }, 100);
  }, 50);

  // Transition toast state to PR Merged and make bubble visible
  setTimeout(() => {
    toast.classList.add('merged-state');
    const badge = document.getElementById(`toast-badge-${prNum}`);
    if (badge) {
      badge.className = 'pr-badge merged';
      badge.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v5.256a2.251 2.251 0 101.5 0V5.372zm8 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM11.5 3a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5zM3.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5zm8.25-1.5a.75.75 0 100 1.5.75.75 0 000-1.5z"></path>
        </svg>
        PR Merged
      `;
    }
    
    // Reveal bubble and push into physics state loop
    latestNode.domElement.style.display = 'flex';
    setTimeout(() => {
      latestNode.domElement.style.opacity = '1';
      latestNode.domElement.style.animation = 'popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1), pulseGlow 1.2s ease-out';
    }, 50);
    
    state.nodes.push(latestNode);

    // Update Counter badge details
    elements.counterBadge.innerText = state.nodes.length;

    // Fade toast out
    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3000);

  }, 1900);
}

// --------------------------------------------------
// Modal Handlers
// --------------------------------------------------
function openModal(node) {
  elements.modalName.innerText = node.name;
  elements.modalDesc.innerText = node.description;
  elements.modalHash.innerText = node.commitHash;
  elements.modal.classList.add('active');
}

function closeModal() {
  elements.modal.classList.remove('active');
}

elements.btnCloseModal.addEventListener('click', closeModal);
elements.btnDoneModal.addEventListener('click', closeModal);
elements.modal.addEventListener('click', (e) => {
  if (e.target === elements.modal) {
    closeModal();
  }
});

// --------------------------------------------------
// Main Entry Initializer (Parse static HTML elements)
// --------------------------------------------------
function init() {
  handleResize();
  window.addEventListener('resize', handleResize);
  setupDragListeners();

  // Find all static .bubble nodes written in HTML
  const staticBubbleElements = Array.from(elements.bubbleContainer.querySelectorAll('.bubble'));
  
  if (staticBubbleElements.length === 0) return;

  // Total initial count in counter dashboard (excluding the last one that gets merged)
  elements.counterBadge.innerText = staticBubbleElements.length - 1;

  // Instantiate physics objects for all but the last item
  const initialNodesCount = staticBubbleElements.length - 1;
  for (let i = 0; i < initialNodesCount; i++) {
    const pNode = new PhysicsNode(staticBubbleElements[i], false);
    state.nodes.push(pNode);
  }

  // Create the physics container node for the last element but keep it hidden
  const latestBubbleElm = staticBubbleElements[staticBubbleElements.length - 1];
  const latestNode = new PhysicsNode(latestBubbleElm, true);

  // Trigger main physics rendering frames loop
  animationFrameTick();

  // Simulate pull request validation and merge for the latest item after 1.8 seconds
  setTimeout(() => {
    simulatePRMerge(latestNode);
  }, 1800);
}

window.addEventListener('DOMContentLoaded', init);
