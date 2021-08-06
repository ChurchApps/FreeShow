// https://dev.to/yezyilomo/global-state-management-in-react-with-global-variables-and-hooks-state-management-doesn-t-have-to-be-so-hard-2n2c

// import { useEffect, useState } from "react";

// function useGlobalState(globalState) {
//     // const [, setState] = useState();
//     const state = globalState.getValue();

//     function reRender(newState) {
//         // This will be called when the global state changes
//         setState({});
//     }

//     useEffect(() => {
//         // Subscribe to a global state when a component mounts
//         globalState.subscribe(reRender);

//         return () => {
//             // Unsubscribe from a global state when a component unmounts
//             globalState.unsubscribe(reRender);
//         }
//     })

//     function setState(newState) {
//         // Send update request to the global state and let it 
//         // update itself
//         globalState.setValue(newState);
//     }

//     return [state, setState];
// }