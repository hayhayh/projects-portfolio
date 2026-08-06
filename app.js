const categories = ['All', ...new Set(projects.map((project) => project.category))];
let activeCategory = 'All';
let query = '';

const filters = document.querySelector('#filters');
const container = document.querySelector('#projects');
const count = document.querySelector('#project-count');

function render() {
  const matching = projects.filter((project) =>
    (activeCategory === 'All' || project.category === activeCategory) &&
    `${project.name} ${project.description} ${project.category}`.toLowerCase().includes(query)
  );
  count.textContent = `${matching.length} project${matching.length === 1 ? '' : 's'}`;
  container.replaceChildren();
  if (!matching.length) {
    container.innerHTML = '<p class="empty">No projects match that search.</p>';
    return;
  }
  matching.forEach((project) => {
    const card = document.createElement('article');
    card.className = 'project';
    const category = document.createElement('span');
    category.className = 'tag';
    category.textContent = project.category;
    const title = document.createElement('h2');
    title.textContent = project.name;
    const description = document.createElement('p');
    description.textContent = project.description;
    card.append(category, title, description);
    if (project.github) {
      const url = new URL(project.github);
      if (url.protocol === 'https:' && url.hostname === 'github.com') {
        const links = document.createElement('div');
        links.className = 'links';
        const link = document.createElement('a');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = 'View on GitHub ↗';
        links.append(link);
        card.append(links);
      }
    }
    container.append(card);
  });
}

categories.forEach((category) => {
  const button = document.createElement('button');
  button.textContent = category;
  button.setAttribute('aria-pressed', category === activeCategory);
  button.addEventListener('click', () => {
    activeCategory = category;
    filters.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', item === button));
    render();
  });
  filters.append(button);
});
document.querySelector('#search').addEventListener('input', (event) => { query = event.target.value.toLowerCase().trim(); render(); });
render();
