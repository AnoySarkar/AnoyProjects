let todoList = JSON.parse(localStorage.getItem('todoList')) || [];
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

  localStorage.setItem('todoList', JSON.stringify(todoList));

  renderTodo();
}


function renderTodo() {

  let todoHTML = '';
  
    for (let i = 0; i < todoList.length; i++){
      
      let todoObject = todoList[i];
      let {name , date} = todoObject;
    
      const html = `
      <div class="show-todo">${name}</div>
      <div class="show-date">${date}</div>

      <button class="remove-btn" onclick="
        todoList.splice(${i}, 1);
        renderTodo ();
      ">Remove</button> 
    `;

      todoHTML += html;

    }
    document.querySelector('.js-show').innerHTML = todoHTML;


}

  
