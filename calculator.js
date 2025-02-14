let show = '';
let temp = '';
let result;
let num;
let mid = '';
let state = false;

function cal(input) {

      

    switch (input) {
        case '=':
            if (temp === '' || mid === '') {
                show = 'invalid input';
                result = 0.0;
            } 
            else {
                cal2();
                mid = '';
                show = 'ans';
                state = true;
            }
            break;

        case 'ac':
            show = '';
            result = undefined;
            temp = '';
            mid = '';
            state = false;
            document.querySelector('.top').innerText = '';
            break;

        case '+':
        case '-':
        case '*':
        case '/':
            if (state) {
                temp = result.toString();
                state = false;
            }
            if (temp === '') return;
            cal2();
            mid = input;
            show += ` ${input} `;
            break;

        default:
            if (state) {
                show = input;
                temp = input;
                state = false;
            } else {
                show += input;
                temp += input;
            }
    }
    

    document.querySelector('.show').innerText = show;
}

function cal2() {
    if (temp === '' && !state) return;

    
    num = parseFloat(temp);
    temp = '';

    

    switch (mid) {
        case '':
            if (result === undefined) result = num;
            break;

        case '+':
            result += num;
            break;

        case '-':
            result -= num;
            break;

        case '*':
            result *= num;
            break;

        case '/':
            if (num === 0) {
                result = 0.0;
                document.querySelector('.top').innerText = 'Error: division by 0';
                return;
              }
            result /= num;
            break;
    }

    document.querySelector('.top').innerText = result;
}
