let todoList = JSON.parse(localStorage.getItem('todoList')) || [];

  document.querySelector('.js-input')
    .addEventListener("keydown",function (event){
      if (event.key === "Enter"){
        addTodo();
      }
    })

    document.addEventListener("DOMContentLoaded", function() {
      renderTodo();
    });

function addTodo() {

  let inputTodo = document.querySelector('.js-input');
  let name = inputTodo.value;

  if (name === '')
    return;

  let inputDate = document.querySelector('.js-input-date');
  let date = inputDate.value;


  todoList.push({
    name,
    date
  });
  
  inputTodo.value = '';

  localStorage.setItem('todoList', JSON.stringify(todoList));

  renderTodo();
}


function renderTodo() {

  let todoHTML = '';
  let total = 0;
  let totalItem = [];
  
    for (let i = 0; i < todoList.length; i++){
      
      let todoObject = todoList[i];
      let {name , date} = todoObject;

      let money = parseInt(name.replace(/\D/g, ""));
      let todoName = name.replace(/\d/g, '');

      total += money;
    
      const html = `
      <div class="show-money">${money}</div>
      <div class="show-todo">${todoName}</div>
      <div class="show-date">${date}</div>

      <button class="remove-btn" onclick="
        todoList.splice(${i}, 1);
         localStorage.setItem('todoList', JSON.stringify(todoList));
        renderTodo ();
      ">Remove</button> 
    `;

      todoHTML += html;
      totalItem.push(todoName);

    }

    document.querySelector('.js-show').innerHTML = todoHTML;
    document.querySelector('.total').innerText = 'Total: ' + total;
    document.querySelector('.totalItem').innerText = totalItem;

}

  
