let show = '';
let temp = '';
let result;
let num;
let start = true;
let mid = '';

     /* console.log(num);
      console.log(temp);
      console.log(result);
      */

function cal(input){


  if (input === '='){
    cal2();
    mid = '';
    show = 'ans';
  }

  // for ac
  else if (input === 'ac'){
    show = '';
    result = 0.0;
    start = true;
    document.querySelector('.top').innerText = '';
  }

  // for +
  else if (input === '+'){
    if (start){
      start = false;
      result = parseFloat(temp);
      temp = '';

    }
    else {
      cal2();
    }
    mid = '+';
    show = show + ` ${input} `;
  }

  // for -
  else if (input === '-'){
    if (start){
      start = false;
      result = parseFloat(temp);
      temp = '';

    }
    else {
      cal2();
    }
    mid = '-';
    show = show + ` ${input} `;
  }

  // for *
  else if (input === '*'){
    if (start){
      start = false;
      result = parseFloat(temp);
      temp = '';

    }
    else {
      cal2();
    }
    mid = '*';
    show = show + ` ${input} `;
  }

  //for /
  else if (input === '/'){
    if (start){
      start = false;
      result = parseFloat(temp);
      temp = '';

    }
    else {
      cal2();
    }
    mid = '/';
    show = show + ` ${input} `;
    
  }

  // all numbers
  else{
    show = show + input;
    temp = temp + input;
  }

  document.querySelector('.show').innerText = show;
   
}

function cal2(){
  if (mid == '+'){
    num = parseFloat(temp);
    result = result + num;
    temp = '';
  }

  else if (mid == '-'){
    num = parseFloat(temp);
    result = result - num;
    temp = '';
  }

  else if (mid == '*'){
    num = parseFloat(temp);
    result = result * num;
    temp = '';
  }

  else if (mid == '/'){
    num = parseFloat(temp);
    result = result / num;
    temp = '';
  }

  document.querySelector('.top').innerText = result;
}