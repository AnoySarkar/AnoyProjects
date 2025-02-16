let todoList = [];
let total = 0;

  document.querySelector('.js-input')
    .addEventListener("keydown",function (event){
      if (event.key === "Enter"){
        addTodo();
      }
    })



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

  renderTodo();
}


function renderTodo() {

  let todoHTML = '';
  total = 0;
  let totalItem = [];
  
    for (let i = 0; i < todoList.length; i++){
      
      let todoObject = todoList[i];
      let {name , date} = todoObject;

      let money = parseInt(name.replace(/\D/g, ""));
      let todoName = name.replace(/\d/g, '');

      total += money;
      console.log(total);
    
      const html = `
      <div class="show-money">${money}</div>
      <div class="show-todo">${todoName}</div>
      <div class="show-date">${date}</div>

      <button class="remove-btn" onclick="
        todoList.splice(${i}, 1);
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

  
