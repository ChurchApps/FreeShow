/**
 * Custom inspector plugin for FreeShow Vite development
 * Provides similar functionality to svelte-inspector for development mode
 */

export function freeShowInspectorPlugin(options = {}) {
  const {
    activateKeyCode = 73, // I(nspect) key
    openFileKeyCode = 79,  // O(pen) key
    editor = 'code',       // VS Code
    color = '#ff3c00'
  } = options

  return {
    name: 'freeshow-inspector',
    apply: 'serve', // Only apply in development
    transformIndexHtml(html) {
      // Inject inspector script into HTML
      const inspectorScript = `
        <script>
          (function() {
            let inspectorEnabled = false;
            let selectedElement = null;
            
            // Enable/disable inspector with keyboard shortcut
            document.addEventListener('keydown', function(e) {
              if (e.keyCode === ${activateKeyCode} && e.ctrlKey) {
                e.preventDefault();
                inspectorEnabled = !inspectorEnabled;
                console.log('Inspector', inspectorEnabled ? 'enabled' : 'disabled');
                
                if (inspectorEnabled) {
                  document.body.style.cursor = 'crosshair';
                  document.body.addEventListener('click', handleInspectorClick, true);
                } else {
                  document.body.style.cursor = '';
                  document.body.removeEventListener('click', handleInspectorClick, true);
                  clearHighlight();
                }
              }
              
              // Open file with keyboard shortcut
              if (e.keyCode === ${openFileKeyCode} && e.ctrlKey && selectedElement) {
                e.preventDefault();
                openInEditor(selectedElement);
              }
            });
            
            function handleInspectorClick(e) {
              if (!inspectorEnabled) return;
              
              e.preventDefault();
              e.stopPropagation();
              
              selectedElement = e.target;
              const componentInfo = findSvelteComponent(selectedElement);
              
              if (componentInfo) {
                console.log('Svelte component found:', componentInfo);
                highlightElement(selectedElement);
              }
            }
            
            function findSvelteComponent(element) {
              // Try to find Svelte component information
              let current = element;
              while (current && current !== document.body) {
                if (current.__svelte_meta) {
                  return current.__svelte_meta;
                }
                current = current.parentElement;
              }
              return null;
            }
            
            function highlightElement(element) {
              clearHighlight();
              element.style.outline = '2px solid ${color}';
              element.setAttribute('data-inspector-highlighted', 'true');
            }
            
            function clearHighlight() {
              const highlighted = document.querySelector('[data-inspector-highlighted]');
              if (highlighted) {
                highlighted.style.outline = '';
                highlighted.removeAttribute('data-inspector-highlighted');
              }
            }
            
            function openInEditor(element) {
              const componentInfo = findSvelteComponent(element);
              if (componentInfo && componentInfo.filename) {
                console.log('Opening in editor:', componentInfo.filename);
                // In a real implementation, this would send a request to the dev server
                // to open the file in the configured editor
              }
            }
            
            console.log('FreeShow Inspector loaded. Press Ctrl+I to toggle, Ctrl+O to open file.');
          })();
        </script>
      `
      
      return html.replace('</head>', `${inspectorScript}</head>`)
    }
  }
}