let expList = JSON.parse(localStorage.getItem('expList')) || [];

let dateExp = JSON.parse(localStorage.getItem('dateExp')) || [{
  dateE: '',
  exp: 0,
  inc: 0,
  type: '',
}];

let type;
let typeD;
let typeE;

console.log(`inside inc= ${dateExp[0].inc}`);




let entryType = document.querySelector('#type');


  document.querySelector('#inputName')
    .addEventListener("keydown",function (event){
      if (event.key === "Enter"){
        typeE = entryType.value;
        typeD = entryType.value;

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
    date,
    typeE
  });

  
  inputTodo.value = '';

  localStorage.setItem('expList', JSON.stringify(expList));

  renderTodo();
  renderDateExp();
}

function addDateExp(date, money){
  
  for (i=0; i < dateExp.length; i++){

    let dateE = dateExp[i].dateE;
  
    type = dateExp[i].type;

    if (dateE === date){
      if (typeD === 'exp'){
        dateExp[i].exp += money;
        return;
      }
      else if (typeD === 'inc'){
        dateExp[i].inc += money;
        return;
      }
    }}
    if (typeD === 'exp'){
      dateExp.push({
        dateE: date,
        exp: money,
        inc:0,
        type: typeD,
      });  

    }
    else if (typeD === 'inc'){
      dateExp.push({
        dateE: date,
        exp:0,
        inc: money,
        type: typeD,
      });  
    }

}


function renderTodo() {


  let todoHTML = '';
  let totalE = 0;
  let totalI = 0;

  let inOut;
  
    for (i=expList.length-1; i >= 0 ; i--){

      type = expList[i].typeE;

      
      let todoObject = expList[i];
      let {name , date} = todoObject;

      let money = parseInt(name.replace(/\D/g, ""));
      let todoName = name.replace(/\d/g, '');


      if (type === 'exp'){
        totalE += money;
        inOut = 'Out';
      }
      else if (type === 'inc'){
        totalI += money;
        inOut = 'In';
      }

    
      const html = `

          <div id="date-lb">${date}</div>
          <div id="name-lb">${todoName}</div>
          <div id="amount-lb">${money}</div>
          <div id="type-lb">${inOut}</div>

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

      
    if (type === 'exp'){
      document.querySelector('#expense').innerText = totalE;
    }
    else if (type === 'inc'){
      document.querySelector('#total').innerText = totalI;

    }

    }

    document.querySelector('#list-body').innerHTML = todoHTML;

}

function renderDateExp(){

  let dateHTML = '';

  for (i=dateExp.length-1; i >= 0 ; i--){


    let html;

    console.log(`inside inc= ${dateExp[i].inc}`);

      if (i === 0){
        html = `
  
        <div id="date-db">Dateless</div>
        <div id="expense-db">${dateExp[i].exp}</div>
        <div id="income-db">${dateExp[i].inc}</div>
      `;}
      else{
      html = `
        <div id="date-db">${dateExp[i].dateE}</div>
        <div id="expense-db">${dateExp[i].exp}</div>
        <div id="income-db">${dateExp[i].inc}</div>
      `;}

    
    dateHTML += html;

  }
  document.querySelector('#date-body').innerHTML = dateHTML;

}

function adjustExp(date,money){

  for (i=0; i < dateExp.length; i++){

    type = dateExp[i].type;

    if (type === 'exp'){
      if (dateExp[i].dateE === date){
        dateExp[i].exp -= money;
        localStorage.setItem('dateExp', JSON.stringify(dateExp));
        return;
      }
    }
    else if (type === 'inc'){
      if (dateExp[i].dateE === date){
        dateExp[i].inc -= money;
        localStorage.setItem('dateExp', JSON.stringify(dateExp));
        return;
      }
    }

      
  }

}

  