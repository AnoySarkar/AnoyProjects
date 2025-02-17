let expList = JSON.parse(localStorage.getItem('expList')) || [];

let dateExp = JSON.parse(localStorage.getItem('dateExp')) || [{
  dateE: '',
  exp: 0,
}];


  document.querySelector('#inputName')
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

  let inputTodo = document.querySelector('#inputName');
  let name = inputTodo.value;

  if (name === '')
    return;

  let inputDate = document.querySelector('#inputDate');
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

          <div id="date-lb">${date}</div>
          <div id="name-lb">${todoName}</div>
          <div id="amount-lb">${money}</div>
          <div id="type-lb">Out</div>

          <div id="remove-lb">
              <button class="remove-btn" onclick="
                  expList.splice(${i}, 1);
                  adjustExp('${date}',${money});

                  localStorage.setItem('expList', JSON.stringify(expList));

            renderTodo ();
            renderDateExp();
          ">Remove</button> 
          
          </div>`;
      todoHTML += html;


    }

    document.querySelector('#list-body').innerHTML = todoHTML;
    document.querySelector('#total').innerText = 'Total: ' + total;

}

function renderDateExp(){

  let dateHTML = '';

  for (i=dateExp.length-1; i >= 0 ; i--){

    let html;

    if (i === 0){
      html = `

      <div id="date-db">Dateless</div>
      <div id="expense-db">${dateExp[i].exp}</div>
      <div id="income-db">0</div>
    `;}
    else{
    html = `
      <div id="date-db">${dateExp[i].dateE}</div>
      <div id="expense-db">${dateExp[i].exp}</div>
      <div id="income-db">0</div>
    `;}

    dateHTML += html;

  }
  document.querySelector('#date-body').innerHTML = dateHTML;

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

  