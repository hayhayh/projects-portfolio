const categoryColors = {
  'AI tools': '#0f7a53',
  'Automation': '#9c4d0a',
  'Browser': '#185f9e',
  'Career': '#9c2a52',
  'Culture': '#6935a0',
  'Data': '#0a6a78',
  'Games': '#a83a19',
  'Learning': '#3f7a19',
  'Personal tools': '#35409c',
  'Travel': '#9c6a0a',
};

const categories = [...new Set(projects.map((project) => project.category))].sort();
let activeCategory = 'All';
let query = '';

const filters = document.querySelector('#filters');
const container = document.querySelector('#projects');
const count = document.querySelector('#project-count');

function buildRow(project) {
  const row = document.createElement('article');
  row.className = 'row';

  const name = document.createElement('h3');
  name.textContent = project.name;
  row.append(name);

  const description = document.createElement('p');
  description.textContent = project.description;
  row.append(description);

  if (project.github) {
    const url = new URL(project.github);
    if (url.protocol === 'https:' && url.hostname === 'github.com') {
      const link = document.createElement('a');
      link.className = 'source';
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'GitHub';
      row.append(link);
    }
  }
  return row;
}

function render() {
  const matching = projects.filter((project) =>
    (activeCategory === 'All' || project.category === activeCategory) &&
    `${project.name} ${project.description} ${project.category}`.toLowerCase().includes(query)
  );
  count.textContent = `${matching.length} project${matching.length === 1 ? '' : 's'}`;
  container.replaceChildren();

  if (!matching.length) {
    container.innerHTML = '<p class="empty">Nothing matches that search.</p>';
    return;
  }

  const groups = new Map();
  matching.forEach((project) => {
    if (!groups.has(project.category)) groups.set(project.category, []);
    groups.get(project.category).push(project);
  });

  [...groups.keys()].sort().forEach((category) => {
    const section = document.createElement('section');
    section.className = 'group';
    section.style.setProperty('--cat', categoryColors[category] || '#4a4a4a');

    const heading = document.createElement('h2');
    const dot = document.createElement('span');
    dot.className = 'dot';
    heading.append(dot, category);
    section.append(heading);

    groups.get(category).forEach((project) => section.append(buildRow(project)));
    container.append(section);
  });
}

function addFilter(category) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = category;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', category === activeCategory);
  button.addEventListener('click', () => {
    activeCategory = category;
    filters.querySelectorAll('button').forEach((item) => item.setAttribute('aria-selected', item === button));
    render();
  });
  filters.append(button);
}

addFilter('All');
categories.forEach(addFilter);
document.querySelector('#search').addEventListener('input', (event) => { query = event.target.value.toLowerCase().trim(); render(); });
render();
