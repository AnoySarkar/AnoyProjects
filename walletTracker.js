let expList = JSON.parse(localStorage.getItem('expList')) || [];
let dateExp = JSON.parse(localStorage.getItem('dateExp')) || [];
let type;
let typeD;
let typeE;
let sound = new Audio("restart2.wav");
let entryType = document.querySelector('#type');

function typeBack(){
  sound.play();
  let typeX = entryType.value;
  if (typeX === 'inc'){
    entryType.style.backgroundColor = '#44d41d';
  } else {
    entryType.style.backgroundColor = 'rgb(251, 26, 26)';
  }
}

document.querySelector('#inputName')
  .addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      typeE = entryType.value;
      typeD = entryType.value;
      sound.play();
      addTodo();
    }
  });

document.addEventListener("DOMContentLoaded", function() {
  renderTodo();
  renderDateExp();
  const today = new Date().toISOString().split('T')[0];
  document.querySelector('#inputDate').value = today;
});

function addTodo() {
  let inputTodo = document.querySelector('#inputName');
  let name = inputTodo.value;
  if (name === '') return;
  let inputDate = document.querySelector('#inputDate');
  let date = inputDate.value;
  let money = parseInt(name.replace(/\D/g, ""));
  addDateExp(date, money);
  localStorage.setItem('dateExp', JSON.stringify(dateExp));
  expList.push({
    name,
    date,
    typeE
  });
  inputTodo.value = '';
  localStorage.setItem('expList', JSON.stringify(expList));
  renderTodo();
  renderDateExp();
}

function addDateExp(date, money) {
  for (let i = 0; i < dateExp.length; i++) {
    if (dateExp[i].dateE === date) {
      if (typeD === 'exp') {
        dateExp[i].exp += money;
        return;
      } else if (typeD === 'inc') {
        dateExp[i].inc += money;
        return;
      }
    }
  }
  if (typeD === 'exp') {
    dateExp.push({
      dateE: date,
      exp: money,
      inc: 0,
      type: typeD
    });
  } else if (typeD === 'inc') {
    dateExp.push({
      dateE: date,
      exp: 0,
      inc: money,
      type: typeD
    });
  }
}

function renderTodo() {
  let todoHTML = '';
  let totalE = 0;
  let totalI = 0;
  let inOut;
  for (let i = expList.length - 1; i >= 0; i--) {
    let type = expList[i].typeE;
    let { name, date } = expList[i];
    let money = parseInt(name.replace(/\D/g, ""));
    let todoName = name.replace(/\d/g, '');
    if (type === 'exp') {
      totalE += money;
      inOut = '🟥';
    } else if (type === 'inc') {
      totalI += money;
      inOut = '🟩';
    }
    const html = `
      <div id="type-lb">${inOut}</div>
      <div id="date-lb">${date}</div>
      <div id="amount-lb">${money}</div>
      <div id="name-lb">${todoName}</div>
      <div id="remove-lb">
          <button class="remove-btn" onclick="
              sound.play();
              adjustExp('${date}', '${type}', ${money});
              expList.splice(${i}, 1);
              localStorage.setItem('expList', JSON.stringify(expList));
              renderTodo();
              renderDateExp();
          ">X</button>
      </div>`;
    todoHTML += html;
    if (type === 'exp') {
      document.querySelector('#expense').innerText = totalE;
    } else if (type === 'inc') {
      document.querySelector('#total').innerText = totalI;
    }
    document.querySelector('#onhand').innerText = totalI - totalE;
  }
  document.querySelector('#list-body').innerHTML = todoHTML;
}

function renderDateExp(){
  let dateHTML = '';
  for (let i = dateExp.length - 1; i >= 0; i--){
    let html;
    html = `
        <div id="date-db">${dateExp[i].dateE}</div>
        <div id="expense-db">${dateExp[i].exp}</div>
        <div id="income-db">${dateExp[i].inc}</div>
      `;
    dateHTML += html;
  }
  document.querySelector('#date-body').innerHTML = dateHTML;
}

function adjustExp(date, type, money) {
  let totalE = parseInt(document.querySelector('#expense').innerText);
  let totalI = parseInt(document.querySelector('#total').innerText);
  let totalO = parseInt(document.querySelector('#onhand').innerText);
  for (let j = 0; j < dateExp.length; j++) {
    if (dateExp[j].dateE === date) {
      if (type === 'exp') {
        dateExp[j].exp -= money;
        document.querySelector('#expense').innerText = totalE - money;
        document.querySelector('#onhand').innerText = totalO + money;
      } else if (type === 'inc') {
        dateExp[j].inc -= money;
        document.querySelector('#total').innerText = totalI - money;
        document.querySelector('#onhand').innerText = totalO - money;
      }
      if (dateExp[j].exp === 0 && dateExp[j].inc === 0){
        dateExp.splice(j, 1);
      }
      break;
    }
  }
  localStorage.setItem('dateExp', JSON.stringify(dateExp));
  }