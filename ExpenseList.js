let expList = JSON.parse(localStorage.getItem('expList')) || [];

let dateExp = JSON.parse(localStorage.getItem('dateExp')) || [{
  dateE: '',
  exp: 0,
}];


  document.querySelector('.js-input')
    .addEventListener("keydown",function (event){
      if (event.key === "Enter"){
        addTodo();
      }
    })

    document.addEventListener("DOMContentLoaded", function() {
      renderTodo();
      renderDateExp();


    });

    

function addTodo() {

  let inputTodo = document.querySelector('.js-input');
  let name = inputTodo.value;

  if (name === '')
    return;

  let inputDate = document.querySelector('.js-input-date');
  let date = inputDate.value;
  let money = parseInt(name.replace(/\D/g, ""));

  addDateExp(date,money);
  localStorage.setItem('dateExp', JSON.stringify(dateExp));


  expList.push({
    name,
    date
  });
  
  inputTodo.value = '';

  localStorage.setItem('expList', JSON.stringify(expList));

  renderTodo();
  renderDateExp();
}

function addDateExp(date, money){
  
  for (i=0; i < dateExp.length; i++){
    let dateObject = dateExp[i];
    let {dateE} = dateObject;

    if (dateE === date){
      dateExp[i].exp += money;
      return;
    }}

    dateExp.push({
      dateE: date,
      exp: money
    });


}


function renderTodo() {

  let todoHTML = '';
  let total = 0;
  let totalItem = [];
  
    for (i=expList.length-1; i >= 0 ; i--){
      
      let todoObject = expList[i];
      let {name , date} = todoObject;

      let money = parseInt(name.replace(/\D/g, ""));
      let todoName = name.replace(/\d/g, '');



      total += money;
    
      const html = `
      <div class="show-date">${date}</div>
      <div class="show-money">${money}</div>
      <div class="show-todo">${todoName}</div>

      <button class="remove-btn" onclick="
        expList.splice(${i}, 1);
        adjustExp('${date}',${money});

          localStorage.setItem('expList', JSON.stringify(expList));

        renderTodo ();
        renderDateExp();
      ">Remove</button> 
    `;
      todoHTML += html;
      if (todoName != ''){
        totalItem.push(todoName);
      }

    }

    document.querySelector('.js-show').innerHTML = todoHTML;
    document.querySelector('.total').innerText = 'Total: ' + total;
    document.querySelector('.totalItem').innerText = totalItem;

}

function renderDateExp(){

  let dateHTML = '';

  for (i=dateExp.length-1; i >= 0 ; i--){

    let html;

    if (i === 0){
      html = `
    <div class="dateExp">Dateless</div>
    <div class="expExp">${dateExp[i].exp}</div>
    `;}
    else{
    html = `
    <div class="dateExp">${dateExp[i].dateE}</div>
    <div class="expExp">${dateExp[i].exp}</div>
    `;}

    dateHTML += html;

  }
  document.querySelector('.exp').innerHTML = dateHTML;

}

function adjustExp(date,money){

  for (i=0; i < dateExp.length; i++){
    if (dateExp[i].dateE === date){
      dateExp[i].exp -= money;
      localStorage.setItem('dateExp', JSON.stringify(dateExp));
      return;
    }
  }

}

  